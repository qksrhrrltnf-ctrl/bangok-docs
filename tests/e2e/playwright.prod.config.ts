import { defineConfig, devices } from '@playwright/test';

/**
 * 운영과 같은 조건의 스모크 테스트: 운영 빌드 설정 + firebase.json 보안 헤더(CSP) + 서비스 워커.
 * 로그인만 우회하기 위해 --mode e2e 로 dist-e2e 에 빌드한다 (배포 대상 dist 와 분리).
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'production.spec.ts',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list']],
  outputDir: '../../test-results/prod',
  use: { baseURL: 'http://127.0.0.1:4273', locale: 'ko-KR', trace: 'retain-on-failure' },
  projects: [{ name: 'chrome', use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome', viewport: { width: 1366, height: 768 } } }],
  webServer: {
    command: 'npm run build:e2e -w apps/web && npm run preview:e2e -w apps/web -- --host 127.0.0.1',
    cwd: '../..',
    url: 'http://127.0.0.1:4273',
    reuseExistingServer: false,
    timeout: 180_000,
    env: { VITE_DEV_AUTH_BYPASS: 'true', VITE_GOOGLE_CLIENT_ID: '', VITE_ALLOWED_DOMAIN: '', VITE_API_BASE: '' },
  },
});
