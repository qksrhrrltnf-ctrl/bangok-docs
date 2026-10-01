import { expect, test } from '@playwright/test';

/**
 * 운영 빌드 스모크: CSP 위반 없이 앱·편집기·문서 엔진 워커가 동작하는지,
 * 서비스 워커가 앱과 편집기를 캐시해 오프라인에서도 열리는지 확인한다 (FR-OFFLINE-001).
 */
test('CSP 위반 없이 새 문서를 만들고, 오프라인에서도 다시 열린다', async ({ page, context }) => {
  const violations: string[] = [];
  const onConsole = (msg: { type(): string; text(): string }) => {
    if (msg.type() === 'error' && /Content Security Policy|Refused to/i.test(msg.text())) violations.push(msg.text());
  };
  page.on('console', onConsole);
  // 모든 프레임(앱, 편집기 iframe)에서 CSP 위반 이벤트를 기록한다.
  await page.addInitScript(() => {
    const w = window as unknown as { __cspErrors?: string[] };
    w.__cspErrors = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      w.__cspErrors!.push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: /새 문서/ })).toBeVisible();

  // 서비스 워커 설치 완료까지 기다린다 (WASM 포함 사전 캐시)
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });

  await page.getByRole('button', { name: /새 문서/ }).click();
  await expect(page.getByRole('button', { name: /^저장/ })).toBeEnabled({ timeout: 60_000 });
  const frame = page.frameLocator('.editor-frame iframe');
  await expect(frame.locator('#scroll-container canvas').first()).toBeVisible({ timeout: 60_000 });

  // 앱과 편집기 iframe 의 CSP 위반을 모은다
  const frames = page.frames();
  expect(frames.some((f) => f.url().includes('/studio/'))).toBe(true);
  for (const f of frames) {
    const errors = await f.evaluate(() => (window as unknown as { __cspErrors?: string[] }).__cspErrors ?? ['감지기 없음']);
    violations.push(...errors);
  }
  expect(violations).toEqual([]);

  // 오프라인: 새로고침해도 앱과 편집기가 열린다
  await page.getByRole('button', { name: '문서 닫고 처음 화면으로' }).click();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: /새 문서/ })).toBeVisible();
  await page.getByRole('button', { name: /새 문서/ }).click();
  await expect(page.getByRole('button', { name: /^저장/ })).toBeEnabled({ timeout: 60_000 });
  await expect(frame.locator('#scroll-container canvas').first()).toBeVisible({ timeout: 60_000 });
  await context.setOffline(false);
});

test('운영 보안 헤더가 붙는다', async ({ request }) => {
  const res = await request.get('/');
  const csp = res.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("frame-ancestors 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toContain("'unsafe-eval'");
  const studio = await request.get('/studio/index.html');
  expect(studio.headers()['content-security-policy']).toBe(csp);
});

test('라이선스 고지 파일과 학교 이름이 배포된다', async ({ request }) => {
  const notices = await request.get('/licenses/THIRD_PARTY_NOTICES.txt');
  expect(notices.ok()).toBe(true);
  const text = await notices.text();
  expect(text).toContain('Copyright (c) 2025-2026 Edward Kim');
  expect(text).toContain('본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.');
  expect(text).toContain('Apache License');
  const index = await (await request.get('/licenses/licenses.json')).json();
  expect(index.components.length).toBeGreaterThan(100);

  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.name).toBe('반곡고 문서 편집기');
  expect(manifest.name).not.toMatch(/한글|한컴|HWP/);
  const html = await (await request.get('/')).text();
  expect(html).toContain('<title>반곡고 문서 편집기</title>');
  expect(html).toContain('반곡고등학교 2026년 정보부장');
});
