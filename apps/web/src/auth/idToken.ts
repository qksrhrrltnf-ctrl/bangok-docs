import { AppError } from '../errors';

/**
 * Google ID 토큰 클레임 확인 (FR-AUTH-003).
 *
 * 브라우저에서는 서명을 검증하지 않는다(공개키 조회·검증은 서버 몫, apps/api/src/auth.ts).
 * 여기서는 화면 진입 판단용으로 iss / aud / exp / hd / sub 를 확인한다.
 * 실제 도메인 차단은 Google Cloud OAuth 동의 화면을 '내부(Internal)'로 설정해 Google 이 한다.
 */

export interface IdTokenClaims {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  iat?: number;
  hd?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

const VALID_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AppError('AUTH_002', 'ID 토큰 형식 오류');
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch (err) {
    throw new AppError('AUTH_002', 'ID 토큰 해석 실패', { cause: err });
  }
}

export function checkIdTokenClaims(
  token: string,
  expected: { clientId: string; allowedDomain: string; nowSeconds?: number },
): IdTokenClaims {
  const c = decodeJwtPayload(token) as Partial<IdTokenClaims>;
  const now = expected.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (!c.iss || !VALID_ISSUERS.has(c.iss)) throw new AppError('AUTH_002', 'issuer 불일치');
  if (c.aud !== expected.clientId) throw new AppError('AUTH_002', 'audience 불일치');
  if (typeof c.exp !== 'number' || c.exp <= now) throw new AppError('AUTH_003');
  if (!c.sub || typeof c.sub !== 'string') throw new AppError('AUTH_002', 'sub 없음');
  // hd 클레임은 Workspace 계정에만 있다. 개인 Gmail 계정에는 없다.
  if (!c.hd || c.hd.toLowerCase() !== expected.allowedDomain.toLowerCase()) {
    throw new AppError('AUTH_001', c.hd ? `hd=${c.hd}` : '개인 계정');
  }
  if (c.email_verified === false) throw new AppError('AUTH_002', '이메일 미확인 계정');
  return c as IdTokenClaims;
}
