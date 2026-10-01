import { defineConfig, devices } from '@playwright/test';

/**
 * E2E (PRD 33장). 개발 서버를 Google 설정 없이 띄우고 테스트 계정으로 들어간다.
 * 사전 조건: npm run build:studio (편집기 빌드), npm run fixtures:generate (합성 문서)
 */
export default defineConfig({
  testDir: '.',
  // 운영 스모크(production.spec.ts)는 playwright.prod.config.ts 에서 운영 빌드로만 실행한다.
  testIgnore: 'production.spec.ts',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  outputDir: '../../test-results',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    locale: 'ko-KR',
    viewport: { width: 1366, height: 768 },
    trace: 'retain-on-failure',
  },
  // 설치된 Google Chrome 을 쓴다 (크롬북의 Chrome 과 같은 엔진). CI 에서는 PLAYWRIGHT_CHANNEL 로 바꿀 수 있다.
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', viewport: { width: 1366, height: 768 } } }],
  webServer: {
    command: 'npm run dev -w apps/web -- --host 127.0.0.1',
    cwd: '../..',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_DEV_AUTH_BYPASS: 'true',
      VITE_GOOGLE_CLIENT_ID: '',
      VITE_ALLOWED_DOMAIN: '',
      VITE_API_BASE: '',
    },
  },
});
