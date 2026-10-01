import { describe, expect, it } from 'vitest';
import { BRAND, COPYRIGHT, DEVELOPER_CREDIT, HWP_SPEC_NOTICE, TRADEMARK_NOTICES } from './branding';

describe('브랜딩과 법적 고지 (docs/legal-review.md)', () => {
  it('학교명과 개발자 표기', () => {
    expect(BRAND.schoolName).toBe('반곡고등학교');
    expect(BRAND.appName).toContain('반곡고');
    expect(DEVELOPER_CREDIT).toBe('개발: 반곡고등학교 2026년 정보부장');
    expect(COPYRIGHT).toBe('© 2026 반곡고등학교');
  });

  it('앱 이름과 짧은 이름에 한컴 상표를 쓰지 않는다 (PRD 8.3)', () => {
    for (const name of [BRAND.appName, BRAND.appShortName]) {
      expect(name).not.toMatch(/한글|한컴|HWP|Hancom|Hangul/i);
    }
  });

  it('한컴 공개 문서 고지 문구는 정해진 문안 그대로다', () => {
    expect(HWP_SPEC_NOTICE).toBe('본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.');
  });

  it('상표 고지를 포함한다', () => {
    expect(TRADEMARK_NOTICES.join(' ')).toContain('주식회사 한글과컴퓨터의 등록 상표');
    expect(TRADEMARK_NOTICES.join(' ')).toContain('Google LLC의 상표');
  });

  it('학교 Workspace 도메인', () => {
    expect(BRAND.domain).toBe('bangok.hs.kr');
  });
});
