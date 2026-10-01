import { env } from '../env';
import { AppError, toAppError } from '../errors';
import { loadScript } from '../google/loadScript';
import { checkIdTokenClaims, type IdTokenClaims } from './idToken';

export const GIS_SRC = 'https://accounts.google.com/gsi/client';

type SignedIn = (claims: IdTokenClaims, idToken: string) => void;
type Failed = (error: AppError) => void;

let handlers: { onSignedIn: SignedIn; onError: Failed } | null = null;
let initialized = false;

/**
 * Google 로그인 초기화. 관리형 크롬북에서는 크롬에 로그인한 학교 계정으로
 * 자동 선택(auto_select)되어 별도 입력 없이 들어온다 (UC-01).
 */
export async function initGoogleSignIn(onSignedIn: SignedIn, onError: Failed): Promise<void> {
  handlers = { onSignedIn, onError };
  await loadScript(GIS_SRC);
  if (initialized) return;
  google.accounts.id.initialize({
    client_id: env.googleClientId,
    hd: env.allowedDomain,
    auto_select: true,
    context: 'use',
    use_fedcm_for_prompt: true,
    itp_support: true,
    callback: (response) => {
      try {
        const claims = checkIdTokenClaims(response.credential, {
          clientId: env.googleClientId,
          allowedDomain: env.allowedDomain,
        });
        handlers?.onSignedIn(claims, response.credential);
      } catch (err) {
        handlers?.onError(toAppError(err, 'AUTH_002'));
      }
    },
  });
  initialized = true;
}

export function promptGoogleSignIn(): void {
  if (initialized) google.accounts.id.prompt();
}

export function renderGoogleButton(container: HTMLElement): void {
  if (!initialized) return;
  container.replaceChildren();
  google.accounts.id.renderButton(container, {
    theme: 'filled_blue',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
    locale: 'ko',
    width: 280,
  });
}

export function disableGoogleAutoSelect(): void {
  try {
    if (initialized) google.accounts.id.disableAutoSelect();
  } catch {
    // GIS 가 없으면 무시
  }
}
