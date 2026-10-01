import branding from './branding.json';

/**
 * 학교 브랜딩과 법적 고지 문구. 학교명·담당자가 바뀌면 branding.json 만 고친다.
 * 법적 검토 근거는 docs/legal-review.md.
 */
export const BRAND = branding;

/** 개발자 표기 (예: "개발: 반곡고등학교 2026년 정보부장") */
export const DEVELOPER_CREDIT = `개발: ${BRAND.schoolName} ${BRAND.developer}`;

export const COPYRIGHT = `© ${BRAND.copyrightYear} ${BRAND.copyrightHolder}`;

/**
 * 한컴 HWP 공개 문서 이용 조건: 공개 문서를 참고해 개발한 결과물은 이 문구를
 * 제품의 UI, 매뉴얼, 도움말, 소스에 모두 적어야 한다. 문서 엔진 rHWP 가 공개 문서를 참고했다.
 */
export const HWP_SPEC_NOTICE = '본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.';

export const TRADEMARK_NOTICES = [
  '"한글", "한컴", "HWP", "HWPX"는 주식회사 한글과컴퓨터의 등록 상표입니다.',
  '"Google", "Google Drive", "Chromebook", "Google Workspace"는 Google LLC의 상표입니다.',
];

export const INDEPENDENCE_NOTICE = `${BRAND.appName}는 ${BRAND.schoolName}가 교육 목적으로 운영하는 독립 서비스입니다. 한글과컴퓨터, Google과 제휴·후원·승인 관계가 없으며 한컴오피스와 모든 서식이 똑같이 보이는 것을 보장하지 않습니다.`;
