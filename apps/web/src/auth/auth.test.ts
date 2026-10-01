import { describe, expect, it } from 'vitest';
import { DEFAULT_ROLES } from '../config/flags';
import { AppError } from '../errors';
import { checkIdTokenClaims } from './idToken';
import { determineRole } from './role';

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
function token(claims: Record<string, unknown>): string {
  return `${b64url({ alg: 'RS256' })}.${b64url(claims)}.sig`;
}

const NOW = 1_800_000_000;
const expected = { clientId: 'client-1', allowedDomain: 'school.kr', nowSeconds: NOW };
const good = {
  iss: 'https://accounts.google.com',
  aud: 'client-1',
  sub: '1234567890',
  exp: NOW + 600,
  hd: 'school.kr',
  email: 'kim@school.kr',
  email_verified: true,
};

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof AppError ? err.code : 'NOT_APP_ERROR';
  }
  return undefined;
}

describe('checkIdTokenClaims (FR-AUTH-003)', () => {
  it('정상 토큰을 통과시키고 sub 를 돌려준다', () => {
    expect(checkIdTokenClaims(token(good), expected).sub).toBe('1234567890');
  });
  it('issuer 가 다르면 거부', () => expect(codeOf(() => checkIdTokenClaims(token({ ...good, iss: 'evil' }), expected))).toBe('AUTH_002'));
  it('audience 가 다르면 거부', () => expect(codeOf(() => checkIdTokenClaims(token({ ...good, aud: 'other' }), expected))).toBe('AUTH_002'));
  it('만료되면 AUTH_003', () => expect(codeOf(() => checkIdTokenClaims(token({ ...good, exp: NOW - 1 }), expected))).toBe('AUTH_003'));
  it('다른 도메인은 AUTH_001 (FR-AUTH-002)', () =>
    expect(codeOf(() => checkIdTokenClaims(token({ ...good, hd: 'other.kr' }), expected))).toBe('AUTH_001'));
  it('hd 가 없는 개인 계정은 AUTH_001', () => {
    const { hd: _hd, ...personal } = good;
    expect(codeOf(() => checkIdTokenClaims(token(personal), expected))).toBe('AUTH_001');
  });
  it('sub 가 없으면 거부', () => {
    const { sub: _sub, ...noSub } = good;
    expect(codeOf(() => checkIdTokenClaims(token(noSub), expected))).toBe('AUTH_002');
  });
  it('형식이 틀린 토큰은 거부', () => expect(codeOf(() => checkIdTokenClaims('abc', expected))).toBe('AUTH_002'));
});

describe('determineRole (FR-AUTH-006)', () => {
  const roles = { adminEmails: ['admin@school.kr'], teacherEmails: ['kim@school.kr'], teacherEmailPattern: '^t\\d+@' };
  it('기본값은 student', () => expect(determineRole('s2026001@school.kr', DEFAULT_ROLES)).toBe('student'));
  it('관리자 목록', () => expect(determineRole('ADMIN@school.kr', roles)).toBe('admin'));
  it('교직원 목록', () => expect(determineRole('kim@school.kr', roles)).toBe('teacher'));
  it('교직원 패턴', () => expect(determineRole('t123@school.kr', roles)).toBe('teacher'));
  it('잘못된 패턴은 무시', () => expect(determineRole('t1@school.kr', { ...roles, teacherEmailPattern: '(' })).toBe('student'));
});
