import { env } from '../env';
import { AppError, toAppError } from '../errors';
import { loadScript } from '../google/loadScript';
import { checkIdTokenClaims, type IdTokenClaims } from './idToken';

export const GIS_SRC = 'https://accounts.google.com/gsi/client';

type SignedIn = (claims: IdTokenClaims, idToken: string) => void;
type Failed = (error: AppError) => void;

let handlers: { onSignedIn: SignedIn; onError: Failed } | null = null;
let initialized = false;
let markReady: () => void = () => undefined;
const ready = new Promise<void>((resolve) => {
  markReady = resolve;
});

/** Google 로그인 초기화가 끝나면 resolve 된다. 로그인 버튼을 그릴 때 기다린다. */
export function whenGoogleReady(): Promise<void> {
  return ready;
}

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
  markReady();
}

/**
 * 계정 선택 창(One Tap)을 띄운다.
 * 로그아웃 직후, 사용자가 창을 닫은 뒤(쿨다운), 브라우저 설정 등으로 창이 뜨지 않을 수 있다.
 * 그때 onUnavailable 이 불려 화면에서 'Google 계정으로 로그인' 버튼을 안내한다.
 */
export function promptGoogleSignIn(onUnavailable?: () => void): void {
  if (!initialized) {
    onUnavailable?.();
    return;
  }
  try {
    google.accounts.id.prompt((n) => {
      try {
        if (n.isNotDisplayed?.() || n.isSkippedMoment?.()) onUnavailable?.();
      } catch {
        // FedCM 에서는 일부 상태 함수가 없을 수 있다
      }
    });
  } catch {
    onUnavailable?.();
  }
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
