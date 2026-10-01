import { BRAND } from './branding';

/** 빌드 시점 환경 설정. 비밀 값은 여기에 두지 않는다 (SEC-003). */
export const env = {
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim(),
  googleApiKey: (import.meta.env.VITE_GOOGLE_API_KEY ?? '').trim(),
  googleAppId: (import.meta.env.VITE_GOOGLE_APP_ID ?? '').trim(),
  /** 기본값은 학교 Workspace 도메인(branding.json). 다른 도메인으로 시험할 때만 환경 변수로 바꾼다. */
  allowedDomain: (import.meta.env.VITE_ALLOWED_DOMAIN || BRAND.domain).trim().toLowerCase(),
  apiBase: (import.meta.env.VITE_API_BASE ?? '').trim().replace(/\/+$/, ''),
  /**
   * 개발 서버와 e2e 전용 빌드(--mode e2e, dist-e2e)에서만 켜진다.
   * 운영 빌드(mode=production)에서는 VITE_DEV_AUTH_BYPASS 값과 관계없이 항상 꺼진다.
   */
  devAuthBypass: (import.meta.env.DEV || import.meta.env.MODE === 'e2e') && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true',
  appVersion: __APP_VERSION__,
  rhwpVersion: __RHWP_VERSION__,
} as const;

export const googleConfigured = env.googleClientId !== '' && env.allowedDomain !== '';
export const driveConfigured = googleConfigured && env.googleApiKey !== '' && env.googleAppId !== '';

/** 자체 호스팅한 rhwp-studio 위치. embed 프로필은 열기·저장을 호스트(이 앱)에 맡긴다. */
export const STUDIO_PATH = '/studio/';
// 디렉터리 주소(/studio/)는 개발 서버에서 앱 자신으로 연결될 수 있어 index.html 을 직접 지정한다.
export const STUDIO_URL = `${STUDIO_PATH}index.html?chrome=embed`;
