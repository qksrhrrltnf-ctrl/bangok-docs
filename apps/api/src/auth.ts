import { OAuth2Client } from 'google-auth-library';
import type { Settings } from './settings.js';

/**
 * Google ID 토큰 검증 (FR-AUTH-002~004, 서버 측).
 * 서명·issuer·audience·만료는 google-auth-library 가, 학교 도메인(hd)과 이메일 확인은 여기서 검사한다.
 */

export interface Principal {
  /** Google sub — 내부 사용자 식별자 */
  sub: string;
  email: string;
  hd: string;
}

export type Role = 'student' | 'teacher' | 'admin';

export interface TokenPayload {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  hd?: string;
  iss?: string;
  aud?: string;
}

export type VerifyToken = (idToken: string) => Promise<TokenPayload>;

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
  }
}

export function googleVerifier(clientId: string): VerifyToken {
  const client = new OAuth2Client(clientId);
  return async (idToken) => {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    return (ticket.getPayload() ?? {}) as TokenPayload;
  };
}

export async function authenticate(
  authorization: string | undefined,
  verify: VerifyToken,
  settings: Pick<Settings, 'allowedDomain'>,
): Promise<Principal> {
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? '');
  if (!match) throw new AuthError('인증 토큰 없음', 401);
  let payload: TokenPayload;
  try {
    payload = await verify(match[1]);
  } catch {
    throw new AuthError('유효하지 않은 토큰', 401);
  }
  if (!payload.sub) throw new AuthError('sub 없음', 401);
  if (!payload.hd || payload.hd.toLowerCase() !== settings.allowedDomain) {
    throw new AuthError('학교 도메인 계정이 아님', 403);
  }
  if (payload.email_verified === false) throw new AuthError('이메일 미확인 계정', 403);
  return { sub: payload.sub, email: (payload.email ?? '').toLowerCase(), hd: payload.hd.toLowerCase() };
}

export function roleOf(email: string, settings: Pick<Settings, 'adminEmails' | 'teacherEmails' | 'teacherEmailPattern'>): Role {
  if (settings.adminEmails.includes(email)) return 'admin';
  if (settings.teacherEmails.includes(email)) return 'teacher';
  if (settings.teacherEmailPattern) {
    try {
      if (new RegExp(settings.teacherEmailPattern, 'i').test(email)) return 'teacher';
    } catch {
      // 잘못된 패턴은 무시
    }
  }
  return 'student';
}
