import { env } from '../env';
import type { ErrorCode } from '../errors';

/**
 * 운영 이벤트 (PRD 11.4, 23장).
 * 금지: 파일 내용, 문서 제목·파일 이름, 학생이 쓴 본문, 민감한 개인정보 (SEC-006).
 * 백엔드가 없으면 아무것도 보내지 않는다.
 */

export type AppEventType =
  | 'app_open'
  | 'file_open'
  | 'file_open_failed'
  | 'save_success'
  | 'save_failed'
  | 'export_pdf'
  | 'unexpected_error';

export interface AppEvent {
  type: AppEventType;
  timestamp: string;
  appVersion: string;
  rhwpVersion: string;
  browserVersion?: string;
  chromeOsVersion?: string;
  errorCode?: ErrorCode;
  /** 파일 형식과 크기 구간만 보낸다. 이름·내용은 보내지 않는다. */
  format?: 'hwp' | 'hwpx' | 'pdf';
  sizeBucket?: '<1MB' | '1-10MB' | '10-50MB' | '>50MB';
  durationMs?: number;
  destination?: 'drive' | 'local';
}

let idTokenProvider: (() => string | null) | null = null;

export function setEventAuth(provider: () => string | null): void {
  idTokenProvider = provider;
}

export function sizeBucket(bytes: number): AppEvent['sizeBucket'] {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return '<1MB';
  if (mb < 10) return '1-10MB';
  if (mb <= 50) return '10-50MB';
  return '>50MB';
}

export function platformInfo(userAgent: string): Pick<AppEvent, 'browserVersion' | 'chromeOsVersion'> {
  const chrome = /Chrome\/([\d.]+)/.exec(userAgent)?.[1];
  const cros = /CrOS \S+ ([\d.]+)/.exec(userAgent)?.[1];
  return { browserVersion: chrome, chromeOsVersion: cros };
}

export function buildEvent(type: AppEventType, extra: Partial<AppEvent> = {}, userAgent = navigator.userAgent): AppEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
    appVersion: env.appVersion,
    rhwpVersion: env.rhwpVersion,
    ...platformInfo(userAgent),
    ...extra,
  };
}

/** 실패해도 사용자 작업을 막지 않는다. */
export function track(type: AppEventType, extra: Partial<AppEvent> = {}): void {
  if (!env.apiBase) return;
  const token = idTokenProvider?.();
  if (!token) return;
  const event = buildEvent(type, extra);
  void fetch(`${env.apiBase}/events`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(event),
  }).catch(() => undefined);
}
