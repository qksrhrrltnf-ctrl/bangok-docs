# rHWP 통합

## 구성

| 구성 요소 | 출처 | 고정 방법 |
|---|---|---|
| `@rhwp/core` (WASM 파서·렌더러·직렬화) | npm | `apps/web/package.json` 정확한 버전 + package-lock |
| `@rhwp/editor` (iframe 임베드 SDK) | npm | 위와 같은 버전이어야 함 (빌드 스크립트가 확인) |
| rhwp-studio (편집기 화면) | GitHub `edwardkim/rhwp` 태그 `v<버전>` | `scripts/build-studio.mjs` 가 태그를 sparse clone 해 빌드 |

Rust 툴체인은 필요 없다. npm 의 `@rhwp/core` 가 wasm-pack 산출물이므로 rhwp-studio 의 `pkg/` 자리에 그대로 넣어 빌드한다.

## 왜 자체 호스팅하나

`@rhwp/editor` 의 기본 `studioUrl` 은 `https://edwardkim.github.io/rhwp/` 다. 그대로 쓰면

- 버전 고정이 깨진다 (개발자 사이트의 최신 코드가 바로 학생 화면에 반영됨)
- 우리가 통제하지 않는 출처에서 편집기가 실행된다
- 오프라인에서 동작하지 않는다

그래서 고정 태그를 빌드해 `/studio/` 에 둔다.

## 빌드 스크립트가 하는 일 (`npm run build:studio`)

1. `@rhwp/core` 버전을 읽고 `@rhwp/editor` 와 같은지 확인
2. `v<버전>` 태그의 `rhwp-studio` 만 sparse clone (로컬 캐시 `%LOCALAPPDATA%\school-hwp-build`, `SCHOOL_HWP_BUILD_DIR` 로 변경 가능)
3. npm 에서 같은 버전 `@rhwp/core` 를 받아 `pkg/` 에 배치
4. 편집기 자체 PWA 플러그인을 뺀 설정으로 `base=/studio/`, `RHWP_WITHOUT_HWPCTRL=1` 빌드 (서비스 워커는 앱 것 하나만)
5. `apps/web/public/studio/` 로 복사, 예제 문서 폴더 제거
6. `studio-manifest.json` 에 WASM 경로 기록 → 앱의 엔진 워커가 같은 파일을 재사용 (10MB 중복 다운로드 방지)

upstream 소스는 수정하지 않는다.

## embed 프로필

편집기를 `/studio/index.html?chrome=embed` 로 연다. embed 프로필에서는 편집기가 새 문서·열기·최근 문서·저장·다른 이름으로 저장·HTML/DOC 내보내기·인쇄·PDF·문서 비교 명령을 등록하지 않는다. 이 앱이 그 기능을 대신한다. 편집기는 Ctrl+S / Ctrl+P 를 삼키기만 하므로, 앱이 같은 출처 iframe 의 키 입력을 받아 저장·PDF 로 연결한다.

## 사용 중인 API

| 용도 | API |
|---|---|
| 로드 | `editor.loadFile(bytes, name, { skipUnsavedGuard, suppressDialogs })` |
| 내보내기 | `editor.exportHwpx()`, `editor.exportHwp()` |
| 변경 감지 | `editor.commands.context().isDirty` (2초 간격). `getDocumentState()` 는 매번 문서 전체 해시를 계산하므로 폴링에 쓰지 않는다 |
| 저장 완료 | `editor.notifySaved(name)` |
| PDF | `editor.getPageSvg(i)` |
| 재파싱 검증 | 워커에서 `new HwpDocument(bytes).pageCount()` |
| 호환성 경고 | `getDocumentInfo()` 의 `fontSubstitutions`, `exportHwpxWithReport().contentLoss()` |
| 새 문서 | `HwpDocument.createEmpty()` → `createBlankDocument()` → `exportHwpx()`. `createEmpty()` 만 쓰면 서식 정의가 없어 재저장에 실패한다 |
| 테스트 텍스트 추출 | `getPageTextLayout(i).runs[].text` (`getPageText` 는 표 셀을 빼므로 쓰지 않음) |

## 알려진 제약 (v0.8.6)

- 브라우저 빌드는 PDF 를 직접 만들지 않는다 → 인쇄 대화상자 방식.
- embed 프로필에서는 편집기의 자동 복구 대화상자가 꺼진다 → 앱이 IndexedDB 에 60초마다 HWPX 임시 저장.
- 0.x 단계라 minor 업데이트에도 API 가 바뀔 수 있다. 인자가 많은 편집 API 는 `*Ex` 변형을 쓴다.

## fork 전환 기준 (PRD 28장)

학교 전용 수정이 필요해지면 `school-org/rhwp` fork 를 만들고 `scripts/build-studio.mjs` 의 `REPO` 와 태그를 `v<버전>-school.<n>` 으로 바꾼다. 범용 수정은 upstream 에 먼저 기여한다.

## 버전 기록

| 날짜 | rHWP | 결과 |
|---|---|---|
| 2026-09-29 | 0.8.6 (studio f1f9c6a) | 합성 코퍼스 6/6 통과, E2E 9/9 통과. 실제 학교 문서·크롬북 실기기 미검증 |
