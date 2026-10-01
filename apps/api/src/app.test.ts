import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createApp } from './app.js';
import type { TokenPayload } from './auth.js';
import type { Settings } from './settings.js';
import { MemoryStore } from './store.js';

const settings: Settings = {
  port: 0,
  googleClientId: 'client-1',
  allowedDomain: 'school.kr',
  adminEmails: ['admin@school.kr'],
  teacherEmails: [],
  teacherEmailPattern: '',
  allowedOrigins: [],
  store: 'memory',
  eventRetentionDays: 90,
};

const USERS: Record<string, TokenPayload> = {
  student: { sub: 's-1', email: 'student@school.kr', hd: 'school.kr', email_verified: true },
  admin: { sub: 'a-1', email: 'admin@school.kr', hd: 'school.kr', email_verified: true },
  outsider: { sub: 'o-1', email: 'x@gmail.com', email_verified: true },
  otherSchool: { sub: 'o-2', email: 'x@other.kr', hd: 'other.kr', email_verified: true },
};

function setup(limit?: number) {
  const store = new MemoryStore();
  const app = createApp({
    settings,
    store,
    verify: async (token) => {
      const u = USERS[token];
      if (!u) throw new Error('bad token');
      return u;
    },
    now: () => new Date('2026-09-29T00:00:00Z'),
    eventRateLimitPerMinute: limit,
  });
  const req = (path: string, init: RequestInit & { as?: string } = {}) => {
    const headers = new Headers(init.headers);
    if (init.as) headers.set('Authorization', `Bearer ${init.as}`);
    return app.request(`/api${path}`, { ...init, headers });
  };
  return { store, req };
}

const event = { type: 'save_failed', appVersion: '0.1.0', rhwpVersion: '0.8.6', errorCode: 'SAVE_002', format: 'hwpx' };

describe('API', () => {
  it('health', async () => {
    const { req } = setup();
    assert.equal((await req('/health')).status, 200);
  });

  it('config 는 허용된 플래그만 내보내고 이메일 목록은 내보내지 않는다', async () => {
    const { req, store } = setup();
    store.config = { flags: { allowHwpSave: true, secret: true }, roles: { adminEmails: ['admin@school.kr'] } };
    const body = (await (await req('/config')).json()) as Record<string, unknown>;
    assert.deepEqual(body.flags, { allowHwpSave: true });
    assert.equal(JSON.stringify(body).includes('admin@school.kr'), false);
  });

  it('토큰이 없으면 401', async () => {
    const { req } = setup();
    assert.equal((await req('/me')).status, 401);
  });

  it('잘못된 토큰이면 401', async () => {
    const { req } = setup();
    assert.equal((await req('/me', { as: 'forged' })).status, 401);
  });

  it('개인 계정·다른 학교는 403 (FR-AUTH-002)', async () => {
    const { req } = setup();
    assert.equal((await req('/me', { as: 'outsider' })).status, 403);
    assert.equal((await req('/me', { as: 'otherSchool' })).status, 403);
  });

  it('/me 는 sub 와 역할을 돌려주고 사용자를 기록한다', async () => {
    const { req, store } = setup();
    const body = (await (await req('/me', { as: 'admin' })).json()) as Record<string, unknown>;
    assert.deepEqual(body, { sub: 'a-1', role: 'admin' });
    assert.equal(store.users.get('a-1')?.role, 'admin');
  });

  it('이벤트는 허용 필드만 저장하고 사용자 정보는 저장하지 않는다', async () => {
    const { req, store } = setup();
    const res = await req('/events', {
      method: 'POST',
      as: 'student',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...event, fileName: '비밀.hwpx', content: '학생 글', email: 'student@school.kr' }),
    });
    assert.equal(res.status, 204);
    assert.equal(store.events.length, 1);
    const saved = JSON.stringify(store.events[0]);
    assert.equal(saved.includes('비밀'), false);
    assert.equal(saved.includes('학생 글'), false);
    assert.equal(saved.includes('student@school.kr'), false);
    assert.equal(saved.includes('s-1'), false);
    assert.equal(store.events[0].errorCode, 'SAVE_002');
  });

  it('알 수 없는 이벤트 유형은 400', async () => {
    const { req } = setup();
    const res = await req('/events', { method: 'POST', as: 'student', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'upload_document', appVersion: '1' }) });
    assert.equal(res.status, 400);
  });

  it('4KB 를 넘는 요청은 413 (문서 업로드 차단)', async () => {
    const { req } = setup();
    const res = await req('/events', {
      method: 'POST',
      as: 'student',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...event, padding: 'x'.repeat(5000) }),
    });
    assert.equal(res.status, 413);
  });

  it('사용자별 분당 이벤트 한도', async () => {
    const { req } = setup(2);
    const send = () => req('/events', { method: 'POST', as: 'student', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
    assert.equal((await send()).status, 204);
    assert.equal((await send()).status, 204);
    assert.equal((await send()).status, 429);
  });

  it('관리자 지표는 관리자만', async () => {
    const { req } = setup();
    assert.equal((await req('/admin/summary', { as: 'student' })).status, 403);
    await req('/me', { as: 'student' });
    for (const type of ['file_open', 'file_open', 'file_open_failed', 'save_success', 'save_failed']) {
      await req('/events', { method: 'POST', as: 'student', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...event, type }) });
    }
    const res = await req('/admin/summary', { as: 'admin' });
    assert.equal(res.status, 200);
    const s = (await res.json()) as Record<string, unknown>;
    assert.equal(s.activeUsers7d, 1);
    assert.equal(Math.round((s.openFailureRate7d as number) * 100), 33);
    assert.equal(s.saveFailureRate7d, 0.5);
  });

  it('문서를 받는 엔드포인트가 없다', async () => {
    const { req } = setup();
    for (const path of ['/upload', '/documents', '/files', '/convert']) {
      const res = await req(path, { method: 'POST', as: 'student', body: 'x' });
      assert.equal(res.status, 404, path);
    }
  });
});
