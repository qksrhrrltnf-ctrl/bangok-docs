# 반곡고 문서 편집기 (school-hwp)

반곡고등학교 크롬북에서 별도 프로그램 설치 없이 HWPX/HWP 문서를 열고, 편집하고, Google Drive 나 크롬북에 저장하는 PWA 입니다. 문서 엔진은 오픈소스 [rHWP](https://github.com/edwardkim/rhwp) 이고, 문서는 브라우저 안에서만 처리합니다.

- 운영: 반곡고등학교
- 개발: 반곡고등학교 2026년 정보부장
- 문의: 반곡고등학교 정보부

본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.

> "한글", "한컴", "HWP", "HWPX"는 주식회사 한글과컴퓨터의 등록 상표입니다. 이 앱은 한글과컴퓨터와 제휴·후원·승인 관계가 없는 반곡고등학교의 독립 서비스이며, 한컴오피스와 모든 서식이 똑같이 보이는 것을 보장하지 않습니다.

## 기능 (PRD v1.1 39장 V1 필수 기능 기준)

| 기능 | 상태 |
|---|---|
| Google Workspace 로그인, 학교 도메인 제한 | 구현 (실제 Google 설정 필요) |
| PWA, 오프라인 실행, 백그라운드 업데이트 | 구현·검증 |
| 새 HWPX 문서 (A4), HWPX·HWP 열기, 끌어다 놓기 | 구현·검증 |
| 텍스트·기본 서식·표 편집 | rhwp-studio 편집기 |
| 로컬 HWPX 저장 (원래 파일 덮어쓰기 / 다른 이름으로) | 구현·검증 |
| 저장 전 검증 (직렬화 → 정적 검사 → 재파싱) | 구현·검증 |
| Google Drive 열기·저장·다른 이름으로 저장, 충돌 감지 | 구현·단위 테스트 (실제 Drive 연동은 설정 후 확인 필요) |
| PDF 출력 (Chrome 인쇄 대화상자) | 구현 |
| 자동 임시 저장·복구 (IndexedDB, 7일) | 구현 |
| 호환성 경고 (저장 손실 요소, 글꼴 대체, HWP 원본) | 구현·검증 |
| 오류 코드·문제 신고, 운영 이벤트 | 구현 |
| 학교 브랜딩, 개발자 표기, 라이선스·상표·한컴 공개 문서 고지, 개인정보 안내 | 구현 (학교명 등은 `apps/web/src/branding.json`) |
| 관리자 화면·기능 플래그 | 구현 |
| Compatibility / Round-trip 테스트 | 구현 (합성 문서). 실제 학교 문서는 익명화 후 추가 필요 |
| Pilot OU 배포 | 절차 문서화 (docs/deployment.md) |

## 빠른 시작

Node.js 22.12 이상과 Git 이 필요합니다. **로컬 디스크**에서 작업하세요 (Google Drive 가상 드라이브에서는 npm 설치가 멈춥니다).

```bash
npm install
npm run build:studio        # 편집기(rhwp-studio v0.8.6) 빌드, 1~2분
npm run fixtures:generate   # 합성 테스트 문서
npm run dev                 # http://127.0.0.1:5173
```

Google 설정 없이 개발 서버를 열면 개발용 계정으로 들어갑니다. 로그인 도메인 기본값은 `bangok.hs.kr` 입니다. 실제 로그인·Drive 는 [docs/google-workspace-integration.md](docs/google-workspace-integration.md) 를 따라 `apps/web/.env.local` 을 채우세요.

## 검증

```bash
npm run verify
```

| 단계 | 명령 | 내용 |
|---|---|---|
| 타입 검사 | `npm run typecheck` | 웹, API |
| 단위 테스트 | `npm test` | 웹 68개, API 12개 |
| 호환성 | `npm run test:compat` | 합성 문서 6개 round-trip |
| E2E | `npm run test:e2e` | 새 문서→편집→저장→다시 열기, HWP→HWPX, 손상 파일 거부 등 7개 |
| 운영 스모크 | `npm run test:e2e:prod` | 운영 빌드 + CSP 위반 없음 + 오프라인 재실행 |

E2E 는 설치된 Google Chrome 을 씁니다. 다른 브라우저는 `PLAYWRIGHT_CHANNEL` 로 지정합니다.

## 문서

- [PRD v1.1](docs/prd.md)
- [아키텍처](docs/architecture.md) · [보안](docs/security.md) · [rHWP 통합](docs/rhwp-integration.md) · [폰트](docs/fonts.md)
- [호환성 검사](docs/compatibility.md) · [Google Workspace 설정](docs/google-workspace-integration.md) · [배포](docs/deployment.md) · [운영](docs/operations.md)
- [법적 검토 (라이선스·상표·개인정보)](docs/legal-review.md) · [개인정보 처리 안내 초안](docs/privacy.md)
- 개발 규칙: [CLAUDE.md](CLAUDE.md)

## 아직 남은 일

- 실제 학교 문서(익명화) 100~300개로 호환성 측정, 한컴 기준 PDF 와 시각 비교
- 크롬북 실기기에서 한글 조합 입력(IME), 성능, 키보드·터치 확인
- Google Cloud 프로젝트·OAuth·Picker 설정 후 실제 로그인·Drive 저장 확인
- 18세 미만 앱 접근 설정, Pilot OU 배포
- 글꼴 자체 호스팅 여부 결정 (docs/fonts.md)

## 저작권과 라이선스

- 학교 자체 코드: Copyright (c) 2026 반곡고등학교. 공개 라이선스는 정하지 않았습니다 ([법적 검토](docs/legal-review.md) 7절).
- 문서 엔진 rHWP: MIT License, Copyright (c) 2025-2026 Edward Kim. 원문은 [NOTICE](NOTICE).
- 포함한 오픈소스 전체(Rust 크레이트 포함)의 고지는 `npm run build:studio` 가 `apps/web/public/licenses/THIRD_PARTY_NOTICES.txt` 로 생성하고, 서비스에서는 `/licenses/THIRD_PARTY_NOTICES.txt` 와 앱의 '앱 정보·라이선스' 화면으로 제공합니다. 카피레프트 라이선스가 섞이면 빌드가 실패합니다.
