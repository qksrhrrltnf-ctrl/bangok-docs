import { describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import { minimalHwpx, OLE_HEADER } from '../test/zip';
import { validateForSave } from './validateForSave';

async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (err) {
    return err instanceof AppError ? err.code : 'NOT_APP_ERROR';
  }
  return undefined;
}

const okParse = async () => ({ pageCount: 2 });

describe('validateForSave (FR-SAVE-005)', () => {
  it('직렬화 결과가 비면 SAVE_001', async () => {
    expect(await codeOf(validateForSave(new Uint8Array(), 'hwpx', okParse))).toBe('SAVE_001');
    expect(await codeOf(validateForSave(null, 'hwpx', okParse))).toBe('SAVE_001');
  });

  it('정적 검사 실패는 SAVE_002', async () => {
    expect(await codeOf(validateForSave(new Uint8Array([1, 2, 3]), 'hwpx', okParse))).toBe('SAVE_002');
  });

  it('요청한 형식과 다르면 SAVE_002', async () => {
    expect(await codeOf(validateForSave(OLE_HEADER, 'hwpx', okParse))).toBe('SAVE_002');
  });

  it('재파싱 실패는 SAVE_002', async () => {
    const failing = async () => {
      throw new Error('parse error');
    };
    expect(await codeOf(validateForSave(minimalHwpx(), 'hwpx', failing))).toBe('SAVE_002');
  });

  it('재파싱 결과 페이지가 0이면 SAVE_002', async () => {
    expect(await codeOf(validateForSave(minimalHwpx(), 'hwpx', async () => ({ pageCount: 0 })))).toBe('SAVE_002');
  });

  it('모두 통과하면 페이지 수를 돌려준다', async () => {
    const r = await validateForSave(minimalHwpx(), 'hwpx', okParse, { pageCount: 2 });
    expect(r).toEqual({ pageCount: 2, warnings: [] });
  });

  it('편집 화면과 쪽 수가 다르면 경고한다 (저장은 허용)', async () => {
    const r = await validateForSave(minimalHwpx(), 'hwpx', okParse, { pageCount: 3 });
    expect(r.warnings[0]).toContain('쪽 수');
  });
});
