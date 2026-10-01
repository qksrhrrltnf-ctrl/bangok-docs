import { useCallback, useEffect, useState } from 'react';
import { env, googleConfigured } from '../env';
import { AppError } from '../errors';
import { setDriveLoginHint } from '../google/driveToken';
import { useApp, type User } from '../store';
import { setEventAuth, track } from '../telemetry/events';
import { initGoogleSignIn, promptGoogleSignIn } from './googleSignIn';
import type { IdTokenClaims } from './idToken';
import { determineRole } from './role';

const SESSION_KEY = 'school-hwp:session:v1';
/** 이 탭에서 사용자가 직접 로그아웃했는지 */
export const SIGNED_OUT_KEY = 'school-hwp:signed-out';

const REVIEW_SESSION = { sub: 'dev-user', email: 'dev@localhost', name: '검토용 계정', hd: 'localhost', dev: true } as const;

function signedOutHere(): boolean {
  try {
    return sessionStorage.getItem(SIGNED_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

function clearSignedOut(): void {
  try {
    sessionStorage.removeItem(SIGNED_OUT_KEY);
  } catch {
    // 무시
  }
}

type StoredSession = Omit<User, 'role'>;

function readSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeSession(s: StoredSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // 무시
  }
}

export type AuthStatus = 'checking' | 'signed-out' | 'signed-in' | 'misconfigured';

/**
 * 로그인 상태 관리.
 * - 운영: Google Identity Services, 학교 도메인(hd)만 허용
 * - 개발 서버: VITE_DEV_AUTH_BYPASS=true 이고 Google 설정이 없으면 테스트 계정 사용
 */
export function useAuth() {
  const config = useApp((s) => s.config);
  const user = useApp((s) => s.user);
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [error, setError] = useState<AppError | null>(null);

  const complete = useCallback(
    (session: StoredSession, idToken: string | null) => {
      const roles = useApp.getState().config?.roles;
      const role = roles ? determineRole(session.email, roles) : 'student';
      clearSignedOut();
      writeSession(session);
      setDriveLoginHint(session.email);
      useApp.getState().signIn({ ...session, role }, idToken);
      setStatus('signed-in');
      setError(null);
      track('app_open');
      // 백엔드가 있으면 역할은 서버가 정한다. 교직원 이메일 목록을 공개 설정 파일에 두지 않기 위해서다.
      if (env.apiBase && idToken) {
        fetch(`${env.apiBase}/me`, { headers: { Authorization: `Bearer ${idToken}` } })
          .then(async (res) => {
            if (!res.ok) return;
            const me = (await res.json()) as { sub?: string; role?: string };
            const current = useApp.getState().user;
            if (current && me.sub === current.sub && (me.role === 'student' || me.role === 'teacher' || me.role === 'admin')) {
              useApp.getState().signIn({ ...current, role: me.role }, useApp.getState().idToken);
            }
          })
          .catch(() => undefined);
      }
    },
    [],
  );

  useEffect(() => {
    setEventAuth(() => useApp.getState().idToken);
  }, []);

  useEffect(() => {
    if (!config) return;
    if (user) {
      setStatus('signed-in');
      return;
    }

    if (!googleConfigured) {
      if (env.devAuthBypass) {
        // 직접 로그아웃한 탭에서는 다시 자동으로 들어가지 않고 로그인 화면을 보여 준다.
        if (signedOutHere()) setStatus('signed-out');
        else complete({ ...REVIEW_SESSION }, null);
      } else {
        setStatus('misconfigured');
      }
      return;
    }

    const stored = readSession();
    const onSignedIn = (claims: IdTokenClaims, idToken: string) =>
      complete(
        {
          sub: claims.sub,
          email: claims.email ?? '',
          name: claims.name ?? claims.email ?? '사용자',
          picture: claims.picture,
          hd: claims.hd ?? '',
        },
        idToken,
      );

    let cancelled = false;
    initGoogleSignIn(onSignedIn, (err) => {
      if (cancelled) return;
      setError(err);
      setStatus('signed-out');
    })
      .then(() => {
        if (cancelled) return;
        if (stored) {
          // 새로고침: 화면은 바로 복원하고, API 용 ID 토큰은 조용히 다시 받는다.
          complete(stored, null);
        } else {
          setStatus('signed-out');
        }
        // 직접 로그아웃한 탭에서는 계정 선택 창을 저절로 띄우지 않는다.
        if (!signedOutHere()) promptGoogleSignIn();
      })
      .catch((err) => {
        if (cancelled) return;
        setError(new AppError('AUTH_002', err instanceof Error ? err.message : String(err)));
        setStatus('signed-out');
      });
    return () => {
      cancelled = true;
    };
    // user 는 로그인 완료 후 바뀌므로 의존성에서 뺀다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, complete]);

  /** 검토용 빌드에서 로그아웃 후 다시 들어가기 */
  const reviewSignIn = useCallback(() => complete({ ...REVIEW_SESSION }, null), [complete]);

  return { status, error, reviewSignIn: env.devAuthBypass && !googleConfigured ? reviewSignIn : null };
}
