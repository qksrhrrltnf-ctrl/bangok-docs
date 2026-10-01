import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { AuthError, authenticate, roleOf, type Principal, type VerifyToken } from './auth.js';
import { EventValidationError, summarize, validateEvent } from './events.js';
import type { Settings } from './settings.js';
import type { Store } from './store.js';

/**
 * 반곡고 문서 편집기 API (PRD 10.3). Copyright (c) 2026 반곡고등학교, 개발: 2026년 정보부장.
 * 하는 일: 인증 검증, 기능 플래그, 오류 이벤트, 관리자 지표.
 * 하지 않는 일: HWP/HWPX 파싱, 문서 내용 저장·검색·분석. 문서를 받는 엔드포인트는 없다.
 */

const FLAG_KEYS = [
  'allowHwpOpen',
  'allowHwpSave',
  'allowHwpxOpen',
  'allowHwpxSave',
  'allowPdfExport',
  'allowDriveIntegration',
  'maintenanceMode',
] as const;

type Env = { Variables: { principal: Principal } };

export interface AppDeps {
  settings: Settings;
  store: Store;
  verify: VerifyToken;
  now?: () => Date;
  /** 사용자별 분당 이벤트 한도 */
  eventRateLimitPerMinute?: number;
}

export function createApp(deps: AppDeps) {
  const { settings, store, verify } = deps;
  const now = deps.now ?? (() => new Date());
  const rateLimit = deps.eventRateLimitPerMinute ?? 120;
  const buckets = new Map<string, { windowStart: number; count: number }>();

  const app = new Hono<Env>().basePath('/api');

  app.use('*', secureHeaders());
  if (settings.allowedOrigins.length > 0) {
    app.use('*', cors({ origin: settings.allowedOrigins, allowHeaders: ['Authorization', 'Content-Type'], maxAge: 600 }));
  }

  const requireUser = async (c: Context<Env>, next: () => Promise<void>) => {
    try {
      c.set('principal', await authenticate(c.req.header('Authorization'), verify, settings));
    } catch (err) {
      if (err instanceof AuthError) return c.json({ error: err.message }, err.status);
      throw err;
    }
    await next();
  };

  app.get('/health', (c) => c.json({ ok: true }));

  /** 기능 플래그 (인증 불필요, 개인정보 없음). 이메일 목록은 내보내지 않는다. */
  app.get('/config', async (c) => {
    const raw = (await store.getAppConfig()) ?? {};
    const flagsSource = (raw.flags && typeof raw.flags === 'object' ? raw.flags : raw) as Record<string, unknown>;
    const flags: Record<string, boolean> = {};
    for (const key of FLAG_KEYS) if (typeof flagsSource[key] === 'boolean') flags[key] = flagsSource[key] as boolean;
    c.header('Cache-Control', 'no-store');
    return c.json({
      flags,
      maintenanceMessage: typeof raw.maintenanceMessage === 'string' ? raw.maintenanceMessage : undefined,
    });
  });

  /** 로그인한 사용자의 역할 (FR-AUTH-006) */
  app.get('/me', requireUser, async (c) => {
    const p = c.get('principal');
    const role = roleOf(p.email, settings);
    await store.touchUser(p.sub, role, now());
    return c.json({ sub: p.sub, role });
  });

  /** 익명 운영 이벤트 (PRD 11.4). 문서 내용·파일 이름·사용자 식별자는 저장하지 않는다. */
  app.post('/events', bodyLimit({ maxSize: 4 * 1024, onError: (c) => c.json({ error: '요청이 너무 큽니다' }, 413) }), requireUser, async (c) => {
    const p = c.get('principal');
    const t = now().getTime();
    const bucket = buckets.get(p.sub);
    if (!bucket || t - bucket.windowStart > 60_000) {
      buckets.set(p.sub, { windowStart: t, count: 1 });
    } else if (++bucket.count > rateLimit) {
      return c.json({ error: '요청이 너무 많습니다' }, 429);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'JSON 형식 오류' }, 400);
    }
    try {
      const event = validateEvent(body, now(), settings.eventRetentionDays);
      await store.addEvent(event);
      if (event.type === 'app_open') await store.touchUser(p.sub, roleOf(p.email, settings), now());
    } catch (err) {
      if (err instanceof EventValidationError) return c.json({ error: err.message }, 400);
      throw err;
    }
    return c.body(null, 204);
  });

  /** 관리자 지표 (PRD 36장). 집계값만 돌려준다. */
  app.get('/admin/summary', requireUser, async (c) => {
    const p = c.get('principal');
    if (roleOf(p.email, settings) !== 'admin') return c.json({ error: '관리자만 볼 수 있습니다' }, 403);
    const since = new Date(now().getTime() - 7 * 24 * 60 * 60 * 1000);
    const [events, activeUsers] = await Promise.all([store.eventsSince(since, 50_000), store.countActiveUsers(since)]);
    c.header('Cache-Control', 'no-store');
    return c.json(summarize(events, activeUsers));
  });

  app.onError((err, c) => {
    // 오류 로그에 요청 본문을 남기지 않는다 (SEC-006, SEC-009)
    console.error(JSON.stringify({ severity: 'ERROR', message: err.message, path: c.req.path }));
    return c.json({ error: '서버 오류' }, 500);
  });

  return app;
}
