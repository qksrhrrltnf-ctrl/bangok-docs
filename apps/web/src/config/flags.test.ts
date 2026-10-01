import { describe, expect, it } from 'vitest';
import { DEFAULT_FLAGS, normalizeConfig } from './flags';

describe('normalizeConfig (PRD 20장)', () => {
  it('빈 입력은 기본값', () => {
    const c = normalizeConfig(null, 'default');
    expect(c.flags).toEqual(DEFAULT_FLAGS);
    expect(c.flags.allowHwpSave).toBe(false);
  });

  it('flags 객체와 평평한 형식을 모두 받는다', () => {
    expect(normalizeConfig({ flags: { allowHwpSave: true } }, 'api').flags.allowHwpSave).toBe(true);
    expect(normalizeConfig({ allowPdfExport: false }, 'api').flags.allowPdfExport).toBe(false);
  });

  it('잘못된 타입과 모르는 키는 버린다', () => {
    const c = normalizeConfig({ flags: { allowHwpSave: 'yes', dropTables: true } }, 'static');
    expect(c.flags.allowHwpSave).toBe(false);
    expect((c.flags as unknown as Record<string, unknown>).dropTables).toBeUndefined();
  });

  it('역할 목록은 소문자로 정리한다', () => {
    const c = normalizeConfig({ roles: { adminEmails: ['Admin@School.kr', 3] } }, 'static');
    expect(c.roles.adminEmails).toEqual(['admin@school.kr']);
  });
});
