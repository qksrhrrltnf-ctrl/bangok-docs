import { describe, expect, it } from 'vitest';
import { AppError } from '../errors';
import { buildZip, minimalHwpx, OLE_HEADER } from '../test/zip';
import { detectFormat, inspectDocument, readZipDirectory } from './inspect';
import { LIMITS } from './limits';

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    return err instanceof AppError ? err.code : 'NOT_APP_ERROR';
  }
  return undefined;
}

describe('detectFormat', () => {
  it('ZIP 시그니처는 HWPX', () => expect(detectFormat(minimalHwpx())).toBe('hwpx'));
  it('OLE 시그니처는 HWP', () => expect(detectFormat(OLE_HEADER)).toBe('hwp'));
  it('HWP 3.0 시그니처는 HWP', () => expect(detectFormat(new TextEncoder().encode('HWP Document File V3.00'))).toBe('hwp'));
  it('그 밖에는 null', () => expect(detectFormat(new TextEncoder().encode('%PDF-1.7'))).toBeNull());
});

describe('readZipDirectory', () => {
  it('항목 이름과 크기를 읽는다', () => {
    const entries = readZipDirectory(minimalHwpx());
    expect(entries.map((e) => e.name)).toEqual(['mimetype', 'version.xml', 'Contents/header.xml', 'Contents/section0.xml']);
    expect(entries[0].uncompressedSize).toBe('application/hwp+zip'.length);
  });

  it('끝 레코드가 없으면 DOC_002', () => {
    expect(codeOf(() => readZipDirectory(new Uint8Array(100)))).toBe('DOC_002');
  });
});

describe('inspectDocument', () => {
  it('정상 HWPX 를 통과시킨다', () => {
    const r = inspectDocument(minimalHwpx(), '과제.hwpx');
    expect(r.format).toBe('hwpx');
    expect(r.entryCount).toBe(4);
    expect(r.warnings).toEqual([]);
  });

  it('정상 HWP 를 통과시킨다', () => {
    expect(inspectDocument(OLE_HEADER, '활동지.HWP').format).toBe('hwp');
  });

  it('빈 파일은 DOC_002', () => expect(codeOf(() => inspectDocument(new Uint8Array(), 'a.hwp'))).toBe('DOC_002'));

  it('다른 확장자는 DOC_004', () => expect(codeOf(() => inspectDocument(OLE_HEADER, 'a.docx'))).toBe('DOC_004'));

  it('크기 제한을 넘으면 DOC_003', () => {
    const limits = { ...LIMITS, maxFileBytes: 10 };
    expect(codeOf(() => inspectDocument(OLE_HEADER.slice(0, 12), 'a.hwp', limits))).toBe('DOC_003');
  });

  it('확장자와 실제 형식이 다르면 경고한다', () => {
    const r = inspectDocument(minimalHwpx(), '이름만바뀐.hwp');
    expect(r.format).toBe('hwpx');
    expect(r.warnings.join()).toContain('실제 형식은 HWPX');
  });

  it('section 이 없는 ZIP 은 DOC_002', () => {
    const zip = buildZip([{ name: 'mimetype', data: 'application/hwp+zip' }]);
    expect(codeOf(() => inspectDocument(zip, 'a.hwpx'))).toBe('DOC_002');
  });

  it('압축 해제 크기가 제한을 넘으면 DOC_003 (ZIP bomb)', () => {
    const zip = minimalHwpx([{ name: 'Contents/section1.xml', data: 'x', fakeUncompressedSize: LIMITS.maxUncompressedBytes + 1 }]);
    expect(codeOf(() => inspectDocument(zip, 'a.hwpx'))).toBe('DOC_003');
  });

  it('비정상 압축률 항목은 DOC_003', () => {
    const zip = minimalHwpx([{ name: 'BinData/big.png', data: 'tiny', fakeUncompressedSize: 11 * 1024 * 1024 }]);
    expect(codeOf(() => inspectDocument(zip, 'a.hwpx'))).toBe('DOC_003');
  });

  it('이미지 개수 제한을 넘으면 DOC_003', () => {
    const images = Array.from({ length: 3 }, (_, i) => ({ name: `BinData/image${i}.png`, data: 'img' }));
    const limits = { ...LIMITS, maxImages: 2 };
    expect(codeOf(() => inspectDocument(minimalHwpx(images), 'a.hwpx', limits))).toBe('DOC_003');
  });

  it('mimetype 값이 표준과 다르면 경고만 한다', () => {
    const zip = buildZip([
      { name: 'mimetype', data: 'application/zip' },
      { name: 'Contents/section0.xml', data: '<sec/>' },
    ]);
    expect(inspectDocument(zip, 'a.hwpx').warnings.join()).toContain('mimetype');
  });
});
