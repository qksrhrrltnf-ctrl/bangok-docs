# 폰트 정책 (PRD v1.1 15.4)

## 앱 화면 글꼴 (디자인 시스템)

- 본문: 페이퍼로지(Paperlogy) 400/500/700/800, 제목: 프리젠테이션(Freesentation) 600/700/800/900. 모두 SIL OFL 1.1.
- `apps/web/src/styles.css` 의 `@font-face` 가 jsDelivr 에서 불러오고, 서비스 워커가 180일 캐시한다. 글꼴을 받지 못하면 Noto Sans KR → 맑은 고딕 → 시스템 글꼴로 표시한다.

## 현재 동작 (rHWP 0.8.6 기본값)

- 학교 문서는 대부분 함초롬바탕·함초롬돋움 등 한컴 계열 글꼴을 쓰고, 크롬북에는 이 글꼴이 없다.
- rhwp-studio 는 문서 글꼴을 공개 웹폰트로 대체해 표시한다. 대체 웹폰트는 `cdn.jsdelivr.net` 에서 받는다 (예: 함초롬돋움 대체 `noonfonts HCRDotum`, 나눔고딕·나눔명조, Noto Sans KR, KoPub).
- 앱의 서비스 워커가 받은 글꼴을 180일 캐시하므로 두 번째부터는 네트워크가 필요 없다.
- 엔진이 글꼴을 대체하면(`fontSubstitutions`) 편집 화면 상단에 "줄바꿈이나 쪽 나눔이 원본과 다를 수 있습니다" 안내를 띄운다.

## 결정이 필요한 것

| 항목 | 선택지 | 권장 |
|---|---|---|
| 글꼴 출처 | ① CDN 유지 ② 학교 서버에 자체 호스팅 | Pilot 은 ①. 전교 배포 전 ② |
| 함초롬 계열 | 한컴 무료 배포 글꼴이지만 웹 재배포 조건 확인 필요 | 한컴 라이선스 확인 후 자체 호스팅 여부 결정 |

CDN 방식에서 외부로 나가는 정보는 글꼴 파일 요청(IP, 글꼴 이름)뿐이고 문서 내용은 나가지 않는다.

## 자체 호스팅으로 바꾸는 방법

1. 재배포가 허용된 글꼴 파일(woff2)을 `apps/web/public/studio/fonts/` 에 넣는 단계를 `scripts/build-studio.mjs` 에 추가
2. 편집기 빌드 시 `RHWP_DISABLE_EXTERNAL_WEBFONTS=1` 로 외부 글꼴을 끈다
3. `firebase.json` CSP 의 `font-src`, `connect-src` 에서 `cdn.jsdelivr.net` 을 뺀다
4. 라이선스 화면(`src/ui/LicensesScreen.tsx`)의 글꼴 목록을 갱신
5. `npm run test:e2e:prod` 로 CSP 위반이 없는지 확인

## 조사할 것 (Sprint 0 Spike)

- 학교 문서 샘플의 `fontsUsed` 빈도: 익명화 코퍼스를 열면 엔진이 글꼴 목록을 준다. 상위 10개를 이 문서에 기록한다.
- 각 글꼴의 대체 웹폰트와 폭 차이 → 줄바꿈 차이 사례를 `docs/compatibility.md` 시각 비교 결과에 연결한다.
