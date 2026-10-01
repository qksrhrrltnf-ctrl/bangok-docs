/**
 * 운영 이벤트 검증 (PRD 11.4, SEC-006).
 * 허용 목록에 있는 필드만 받고, 나머지는 버린다. 사용자 식별자·파일 이름·문서 내용은 저장하지 않는다.
 */

export const EVENT_TYPES = [
  'app_open',
  'file_open',
  'file_open_failed',
  'save_success',
  'save_failed',
  'export_pdf',
  'unexpected_error',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface StoredEvent {
  type: EventType;
  clientTimestamp: string | null;
  receivedAt: Date;
  expireAt: Date;
  appVersion: string;
  rhwpVersion: string | null;
  browserVersion: string | null;
  chromeOsVersion: string | null;
  errorCode: string | null;
  format: 'hwp' | 'hwpx' | 'pdf' | null;
  sizeBucket: '<1MB' | '1-10MB' | '10-50MB' | '>50MB' | null;
  durationMs: number | null;
  destination: 'drive' | 'local' | null;
}

const VERSION = /^[0-9A-Za-z.+-]{1,32}$/;
const ERROR_CODE = /^[A-Z]{2,8}_\d{3}$/;
const FORMATS = new Set(['hwp', 'hwpx', 'pdf']);
const BUCKETS = new Set(['<1MB', '1-10MB', '10-50MB', '>50MB']);
const DESTINATIONS = new Set(['drive', 'local']);

export class EventValidationError extends Error {}

function optionalMatch(v: unknown, re: RegExp): string | null {
  return typeof v === 'string' && re.test(v) ? v : null;
}

function optionalIn<T extends string>(v: unknown, set: Set<string>): T | null {
  return typeof v === 'string' && set.has(v) ? (v as T) : null;
}

export function validateEvent(body: unknown, now: Date, retentionDays: number): StoredEvent {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new EventValidationError('JSON 객체가 아님');
  const b = body as Record<string, unknown>;
  if (typeof b.type !== 'string' || !(EVENT_TYPES as readonly string[]).includes(b.type)) {
    throw new EventValidationError('알 수 없는 이벤트 유형');
  }
  const appVersion = optionalMatch(b.appVersion, VERSION);
  if (!appVersion) throw new EventValidationError('appVersion 형식 오류');

  const ts = typeof b.timestamp === 'string' && !Number.isNaN(Date.parse(b.timestamp)) ? new Date(b.timestamp).toISOString() : null;
  const duration = typeof b.durationMs === 'number' && Number.isFinite(b.durationMs) && b.durationMs >= 0 && b.durationMs < 3_600_000
    ? Math.round(b.durationMs)
    : null;

  return {
    type: b.type as EventType,
    clientTimestamp: ts,
    receivedAt: now,
    expireAt: new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000),
    appVersion,
    rhwpVersion: optionalMatch(b.rhwpVersion, VERSION),
    browserVersion: optionalMatch(b.browserVersion, VERSION),
    chromeOsVersion: optionalMatch(b.chromeOsVersion, VERSION),
    errorCode: optionalMatch(b.errorCode, ERROR_CODE),
    format: optionalIn(b.format, FORMATS),
    sizeBucket: optionalIn(b.sizeBucket, BUCKETS),
    durationMs: duration,
    destination: optionalIn(b.destination, DESTINATIONS),
  };
}

export interface Summary {
  activeUsers7d: number;
  events7d: Record<string, number>;
  openFailureRate7d: number | null;
  saveFailureRate7d: number | null;
  topErrorCodes7d: { code: string; count: number }[];
}

export function summarize(events: Pick<StoredEvent, 'type' | 'errorCode'>[], activeUsers: number): Summary {
  const counts: Record<string, number> = {};
  const errors = new Map<string, number>();
  for (const e of events) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
    if (e.errorCode) errors.set(e.errorCode, (errors.get(e.errorCode) ?? 0) + 1);
  }
  const rate = (fail: string, ok: string) => {
    const f = counts[fail] ?? 0;
    const total = f + (counts[ok] ?? 0);
    return total === 0 ? null : f / total;
  };
  return {
    activeUsers7d: activeUsers,
    events7d: counts,
    openFailureRate7d: rate('file_open_failed', 'file_open'),
    saveFailureRate7d: rate('save_failed', 'save_success'),
    topErrorCodes7d: [...errors.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count })),
  };
}
