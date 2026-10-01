import { GIS_SRC } from '../auth/googleSignIn';
import { env } from '../env';
import { AppError } from '../errors';
import { loadScript } from './loadScript';

/** 최소 권한: 앱이 만들었거나 사용자가 Picker 로 고른 파일만 접근 (FR-DRIVE-002, SEC-004) */
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

let token: { value: string; expiresAt: number } | null = null;
let inflight: Promise<string> | null = null;
let loginHint = '';

export function setDriveLoginHint(email: string): void {
  loginHint = email;
}

/**
 * Drive 접근 토큰을 받는다. 처음 한 번은 동의 창이 뜨므로 버튼 클릭 등 사용자 동작 안에서 부른다.
 * 토큰은 메모리에만 두고 저장소에 쓰지 않는다.
 */
export async function getDriveAccessToken(): Promise<string> {
  if (token && token.expiresAt - 60_000 > Date.now()) return token.value;
  if (inflight) return inflight;
  await loadScript(GIS_SRC);
  inflight = new Promise<string>((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: env.googleClientId,
      scope: DRIVE_SCOPE,
      hint: loginHint || undefined,
      hosted_domain: env.allowedDomain || undefined,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new AppError('DRIVE_003', resp.error_description || resp.error));
          return;
        }
        if (!resp.scope.split(' ').includes(DRIVE_SCOPE)) {
          reject(new AppError('DRIVE_003', 'drive.file 권한이 허용되지 않음'));
          return;
        }
        token = { value: resp.access_token, expiresAt: Date.now() + resp.expires_in * 1000 };
        resolve(resp.access_token);
      },
      error_callback: (err) => {
        reject(new AppError('DRIVE_003', err.type === 'popup_closed' ? '권한 창을 닫았습니다' : err.type));
      },
    });
    client.requestAccessToken({ prompt: '' });
  }).finally(() => {
    inflight = null;
  });
  return inflight;
}

/** 401 응답을 받았을 때 호출해 다음 요청에서 새 토큰을 받게 한다. */
export function invalidateDriveToken(): void {
  token = null;
}

/** 로그아웃 시 토큰을 폐기한다. */
export function revokeDriveToken(): void {
  const current = token;
  token = null;
  if (current && typeof google !== 'undefined' && google.accounts?.oauth2) {
    google.accounts.oauth2.revoke(current.value);
  }
}

export function hasDriveToken(): boolean {
  return token !== null && token.expiresAt > Date.now();
}
