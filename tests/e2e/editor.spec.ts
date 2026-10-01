import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type FrameLocator, type Page } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'fixtures', 'synthetic');

/**
 * 파일 선택·저장 창은 자동화할 수 없으므로 File System Access API 를 가짜로 바꾼다.
 * 저장한 바이트는 window.__saved 에, 열 파일은 window.__nextOpen 에 둔다.
 */
async function installFakeFileSystem(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__saved = null;
    w.__nextOpen = null;
    const makeHandle = (name: string) => ({
      kind: 'file',
      name,
      async getFile() {
        const s = w.__saved as { name: string; bytes: number[] } | null;
        return new File([new Uint8Array(s?.bytes ?? [])], name);
      },
      async createWritable() {
        const chunks: BlobPart[] = [];
        return {
          async write(data: BlobPart) {
            chunks.push(data);
          },
          async close() {
            const buf = new Uint8Array(await new Blob(chunks).arrayBuffer());
            w.__saved = { name, bytes: Array.from(buf) };
          },
        };
      },
    });
    w.showSaveFilePicker = async (opts: { suggestedName: string }) => makeHandle(opts.suggestedName);
    w.showOpenFilePicker = async () => {
      const next = w.__nextOpen as { name: string; bytes: number[] } | null;
      if (!next) throw new DOMException('취소', 'AbortError');
      w.__nextOpen = null;
      const file = new File([new Uint8Array(next.bytes)], next.name);
      return [{ ...makeHandle(next.name), getFile: async () => file }];
    };
  });
}

async function setNextOpen(page: Page, name: string, bytes: Uint8Array | number[]) {
  await page.evaluate(([n, b]) => {
    (window as unknown as Record<string, unknown>).__nextOpen = { name: n, bytes: b };
  }, [name, Array.from(bytes)] as const);
}

async function savedFile(page: Page): Promise<{ name: string; bytes: number[] } | null> {
  return page.evaluate(() => (window as unknown as Record<string, unknown>).__saved as { name: string; bytes: number[] } | null);
}

function editorFrame(page: Page): FrameLocator {
  return page.frameLocator('.editor-frame iframe');
}

async function waitEditorReady(page: Page) {
  await expect(page.getByRole('button', { name: /^저장/ })).toBeEnabled({ timeout: 60_000 });
  await expect(editorFrame(page).locator('#scroll-container canvas').first()).toBeVisible({ timeout: 60_000 });
}

async function typeInEditor(page: Page, text: string) {
  const canvas = editorFrame(page).locator('#scroll-container canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('편집 캔버스를 찾지 못함');
  await page.mouse.click(box.x + box.width / 2, box.y + 120);
  await page.waitForTimeout(300);
  for (const ch of text) await page.keyboard.type(ch, { delay: 20 });
  await page.waitForTimeout(300);
}

const externalRequests: string[] = [];

test.beforeEach(async ({ page }) => {
  externalRequests.length = 0;
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && !url.protocol.startsWith('data') && !url.protocol.startsWith('blob')) {
      externalRequests.push(`${req.method()} ${url.hostname}`);
    }
  });
  await installFakeFileSystem(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /새 문서/ })).toBeVisible();
});

test('새 문서 → 편집 → 저장 → 다시 열기 (PRD 33장)', async ({ page }) => {
  await page.getByRole('button', { name: /새 문서/ }).click();
  await waitEditorReady(page);
  await expect(page.locator('.save-state')).toHaveText('저장됨');

  await typeInEditor(page, '학교 문서 편집기 시험');
  await expect(page.locator('.save-state')).toContainText('저장하지 않은 변경', { timeout: 10_000 });

  // 새 문서는 저장 위치를 묻는다 (Drive 미설정 → 이 크롬북)
  await page.keyboard.press('Control+s');
  const dialog = page.getByRole('dialog', { name: '다른 이름으로 저장' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('HWPX (권장)')).toBeChecked();
  await expect(dialog.getByLabel(/HWP 호환 저장/)).toBeDisabled();
  await dialog.getByLabel('파일 이름').fill('시험 문서');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();

  await expect(page.getByText('저장했습니다: 시험 문서.hwpx')).toBeVisible();
  await expect(page.locator('.save-state')).toHaveText('저장됨', { timeout: 10_000 });

  const saved = await savedFile(page);
  expect(saved?.name).toBe('시험 문서.hwpx');
  const bytes = new Uint8Array(saved!.bytes);
  expect(bytes.slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b])); // ZIP(HWPX)

  // 같은 파일에 다시 저장하면 대화상자 없이 덮어쓴다 (핸들 유지)
  await typeInEditor(page, '추가');
  await expect(page.locator('.save-state')).toContainText('저장하지 않은 변경', { timeout: 10_000 });
  await page.getByRole('button', { name: /^저장/ }).click();
  await expect(page.getByText('저장했습니다: 시험 문서.hwpx')).toHaveCount(1, { timeout: 10_000 });

  // 처음 화면으로 돌아가 다시 연다
  await page.getByRole('button', { name: '문서 닫고 처음 화면으로' }).click();
  await expect(page.getByRole('button', { name: /파일 열기/ })).toBeVisible();
  const again = (await savedFile(page))!;
  await setNextOpen(page, again.name, again.bytes);
  await page.getByRole('button', { name: /파일 열기/ }).click();
  await waitEditorReady(page);
  await expect(page.locator('.doc-title')).toContainText('시험 문서.hwpx');

  // 문서는 외부 서버로 나가지 않는다 (Local-first). 편집기 대체 글꼴 CDN 요청만 허용한다.
  const disallowed = externalRequests.filter((r) => !r.endsWith('cdn.jsdelivr.net'));
  expect(disallowed).toEqual([]);
});

test('저장된 파일에 입력한 글자가 들어 있다 (Node 엔진으로 재확인)', async ({ page }) => {
  await page.getByRole('button', { name: /새 문서/ }).click();
  await waitEditorReady(page);
  await typeInEditor(page, '가나다라 1234');
  await expect(page.locator('.save-state')).toContainText('저장하지 않은 변경', { timeout: 10_000 });
  await page.keyboard.press('Control+s');
  const dialog = page.getByRole('dialog', { name: '다른 이름으로 저장' });
  await dialog.getByLabel('파일 이름').fill('내용 확인');
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('저장했습니다: 내용 확인.hwpx')).toBeVisible();

  const saved = (await savedFile(page))!;
  const { openDocument, allText, normalizeText } = await import('../support/rhwp-node.mjs');
  const doc = openDocument(new Uint8Array(saved.bytes));
  expect(normalizeText(allText(doc))).toContain('가나다라 1234');
  doc.free();
});

test('HWP 문서를 열면 호환성 안내를 보여 주고 HWPX 새 파일로 저장한다 (UC-03)', async ({ page }) => {
  await setNextOpen(page, '과학 보고서.hwp', readFileSync(join(FIXTURES, 'text-korean.hwp')));
  await page.getByRole('button', { name: /파일 열기/ }).click();
  await waitEditorReady(page);
  await expect(page.getByRole('note')).toContainText('HWP 문서입니다');

  // HWP 원본은 HWPX 로 덮어쓸 수 없으므로 저장 대화상자가 열린다
  await page.getByRole('button', { name: /^저장/ }).click();
  const dialog = page.getByRole('dialog', { name: '다른 이름으로 저장' });
  await expect(dialog.getByLabel('파일 이름')).toHaveValue('과학 보고서');
  await expect(dialog.getByLabel('HWPX (권장)')).toBeChecked();
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText('저장했습니다: 과학 보고서.hwpx')).toBeVisible();
  await expect(page.locator('.doc-title')).toContainText('과학 보고서.hwpx');
});

test('표가 있는 HWPX 활동지를 열 수 있다', async ({ page }) => {
  await setNextOpen(page, '모둠 활동지.hwpx', readFileSync(join(FIXTURES, 'table-worksheet.hwpx')));
  await page.getByRole('button', { name: /파일 열기/ }).click();
  await waitEditorReady(page);
  await expect(page.locator('.doc-meta')).toContainText('1쪽');
  await expect(page.locator('.doc-meta')).toContainText('HWPX');
});

test('손상된 파일은 열지 않고 오류 코드를 보여 준다 (SEC-008)', async ({ page }) => {
  await setNextOpen(page, '손상.hwpx', new TextEncoder().encode('PK\u0003\u0004 이것은 HWPX 가 아님'));
  await page.getByRole('button', { name: /파일 열기/ }).click();
  const alert = page.getByRole('alertdialog');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('DOC_002');
  await expect(alert).not.toContainText('손상.hwpx');
  await alert.getByRole('button', { name: '확인' }).click();
  await expect(page.getByRole('button', { name: /새 문서/ })).toBeVisible();
});

test('HWP/HWPX 가 아닌 파일은 거부한다 (FR-OPEN-001)', async ({ page }) => {
  await setNextOpen(page, '보고서.docx', new Uint8Array([0x50, 0x4b, 3, 4]));
  await page.getByRole('button', { name: /파일 열기/ }).click();
  await expect(page.getByRole('alertdialog')).toContainText('DOC_004');
});

test('저장하지 않고 닫으려 하면 확인한다', async ({ page }) => {
  await page.getByRole('button', { name: /새 문서/ }).click();
  await waitEditorReady(page);
  await typeInEditor(page, '임시');
  await expect(page.locator('.save-state')).toContainText('저장하지 않은 변경', { timeout: 10_000 });
  await page.getByRole('button', { name: '문서 닫고 처음 화면으로' }).click();
  const dialog = page.getByRole('dialog', { name: '저장하지 않은 변경이 있습니다' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '저장하지 않고 닫기' }).click();
  await expect(page.getByRole('button', { name: /새 문서/ })).toBeVisible();
});

test('학교명·개발자 표기와 법적 고지가 화면에 있다 (docs/legal-review.md)', async ({ page }) => {
  await expect(page).toHaveTitle('반곡고 문서 편집기');
  const footer = page.locator('.app-footer');
  await expect(footer).toContainText('© 2026 반곡고등학교');
  await expect(footer).toContainText('개발: 반곡고등학교 2026년 정보부장');
  await expect(footer).toContainText('본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.');

  await page.getByRole('button', { name: '앱 정보·라이선스' }).first().click();
  await expect(page.getByRole('heading', { name: '반곡고 문서 편집기' })).toBeVisible();
  await expect(page.getByText('주식회사 한글과컴퓨터의 등록 상표')).toBeVisible();
  await page.getByText('rHWP 라이선스 원문 (MIT)').click();
  await expect(page.locator('.license-text')).toContainText('Copyright (c) 2025-2026 Edward Kim');
  await expect(page.getByRole('link', { name: '제3자 소프트웨어 고지' })).toHaveAttribute('href', '/licenses/THIRD_PARTY_NOTICES.txt');

  await page.getByRole('button', { name: '개인정보 처리 안내 보기' }).click();
  await expect(page.getByText('문서 내용과 파일 이름은 학교 서버로 보내지 않습니다.')).toBeVisible();
});

test('인터랙션: 마스코트 팁과 목차 스크롤 스파이 (CNM 디자인)', async ({ page }) => {
  const mascot = page.getByRole('button', { name: /^도우미:/ });
  const before = await mascot.getAttribute('aria-label');
  await mascot.click();
  await expect(mascot).not.toHaveAttribute('aria-label', before ?? '');

  await page.getByRole('button', { name: '앱 정보·라이선스' }).first().click();
  const toc = page.getByRole('navigation', { name: '앱 정보 목차' });
  await expect(toc.getByRole('link')).toHaveCount(5);
  await toc.getByRole('link', { name: /글꼴/ }).click();
  await expect(toc.getByRole('link', { name: /글꼴/ })).toHaveClass(/active/);
  await expect(page.locator('#font-title')).toBeInViewport();
});

test('11.6인치 크롬북(1366×635 브라우저 탭)에서 시작 버튼과 편집 영역이 충분하다', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 635 });
  await page.reload();
  const cards = page.locator('.action-card');
  await expect(cards.first()).toBeVisible();
  for (const box of await cards.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom))) {
    expect(box).toBeLessThanOrEqual(635);
  }
  await page.getByRole('button', { name: /새 문서/ }).click();
  await expect(page.locator('.editor-frame iframe')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.frameLocator('.editor-frame iframe').locator('#scroll-container canvas').first()).toBeVisible({ timeout: 60_000 });
  const barHeight = await page.locator('.editor-bar').evaluate((e) => e.getBoundingClientRect().height);
  expect(barHeight).toBeLessThanOrEqual(64);
  const frameHeight = await page.locator('.editor-frame').evaluate((e) => e.getBoundingClientRect().height);
  expect(frameHeight).toBeGreaterThanOrEqual(560);
});

test('로그인한 계정이 항상 보이고, 로그아웃 후 다시 들어갈 수 있다', async ({ page }) => {
  // 처음 화면: 이름·이메일·구분 표시
  const chip = page.locator('.app-header .account-chip');
  await expect(chip).toContainText('검토용 계정');
  await expect(chip).toContainText('dev@localhost');
  await chip.click();
  const menu = page.getByRole('dialog', { name: '계정 정보' });
  await expect(menu).toContainText('dev@localhost');
  await expect(menu).toContainText('검토용');
  await page.keyboard.press('Escape');

  // 편집 화면에서도 계정이 보인다
  await page.getByRole('button', { name: /새 문서/ }).click();
  await expect(page.locator('.editor-bar .account-chip')).toContainText('dev@localhost');
  await page.getByRole('button', { name: '문서 닫고 처음 화면으로' }).click();

  // 로그아웃 → 로그인 화면 → 새로고침해도 저절로 들어가지 않음 → 다시 들어가기
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.getByRole('button', { name: '임시 문서 남기기' }).click();
  const reEnter = page.getByRole('button', { name: '검토용 계정으로 들어가기' });
  await expect(reEnter).toBeVisible();
  await page.reload();
  await expect(reEnter).toBeVisible();
  await reEnter.click();
  await expect(page.getByRole('button', { name: /새 문서/ })).toBeVisible();
  await expect(chip).toContainText('dev@localhost');
});
