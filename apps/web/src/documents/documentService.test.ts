import { describe, expect, it } from 'vitest';
import { DEFAULT_FLAGS } from '../config/flags';
import { AppError } from '../errors';
import { buildCompatReport } from '../validation/compatWarnings';
import { assertSaveAllowed, canOverwrite } from './documentService';

const driveDoc = {
  fileName: '과제.hwpx',
  sourceFormat: 'hwpx' as const,
  source: { kind: 'drive' as const, snapshot: { fileId: 'f', name: '과제.hwpx', headRevisionId: 'r' } },
};

describe('canOverwrite', () => {
  it('같은 형식의 Drive 파일은 덮어쓸 수 있다', () => expect(canOverwrite(driveDoc, 'hwpx', 'drive')).toBe(true));
  it('형식이 바뀌면 새 파일로 저장해야 한다 (UC-03)', () => expect(canOverwrite(driveDoc, 'hwp', 'drive')).toBe(false));
  it('저장 위치가 바뀌면 새 파일', () => expect(canOverwrite(driveDoc, 'hwpx', 'local')).toBe(false));
  it('HWP 원본을 HWPX 로 저장하면 새 파일', () => {
    const hwpDoc = { ...driveDoc, fileName: '옛문서.hwp', sourceFormat: 'hwp' as const };
    expect(canOverwrite(hwpDoc, 'hwpx', 'drive')).toBe(false);
  });
  it('핸들 없는 로컬 파일은 새 위치를 물어야 한다', () => {
    expect(canOverwrite({ ...driveDoc, source: { kind: 'local', handle: null } }, 'hwpx', 'local')).toBe(false);
  });
  it('새 문서는 덮어쓸 대상이 없다', () => {
    expect(canOverwrite({ ...driveDoc, source: { kind: 'new' } }, 'hwpx', 'drive')).toBe(false);
  });
});

describe('assertSaveAllowed (PRD 20장 기능 플래그)', () => {
  it('HWP 저장은 기본적으로 꺼져 있다', () => {
    expect(() => assertSaveAllowed('hwp', DEFAULT_FLAGS, 'local')).toThrowError(AppError);
  });
  it('HWPX 저장은 허용', () => expect(() => assertSaveAllowed('hwpx', DEFAULT_FLAGS, 'drive')).not.toThrow());
  it('Drive 연동이 꺼지면 Drive 저장 불가', () => {
    expect(() => assertSaveAllowed('hwpx', { ...DEFAULT_FLAGS, allowDriveIntegration: false }, 'drive')).toThrowError(AppError);
  });
});

describe('buildCompatReport (FR-OPEN-003)', () => {
  it('손실 요소와 글꼴 대체를 경고한다', () => {
    const r = buildCompatReport({
      sourceFormat: 'hwp',
      inspectionWarnings: [],
      info: { fontsUsed: ['함초롬바탕'], fontSubstitutions: [{ original: '휴먼명조' }, '맑은 고딕'] },
      loss: { count: 2, losses: [{}, {}] },
    });
    expect(r.lossCount).toBe(2);
    expect(r.substitutedFonts).toEqual(['휴먼명조', '맑은 고딕']);
    expect(r.warnings.some((w) => w.includes('완전히 지원하지 않는 요소가 2개'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('휴먼명조'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('HWPX 형식을 권장'))).toBe(true);
  });

  it('문제가 없으면 경고가 없다', () => {
    const r = buildCompatReport({ sourceFormat: 'hwpx', inspectionWarnings: [], info: { fontSubstitutions: [] }, loss: { count: 0, losses: [] } });
    expect(r.warnings).toEqual([]);
  });
});
