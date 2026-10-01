# 아키텍처

## 한눈에 보기

```text
관리형 크롬북 (Chrome)
└─ 반곡고 문서 편집기 PWA  (예: https://docs.bangok.hs.kr, Firebase Hosting)
   ├─ 앱 셸 (React)            열기·저장·Drive·PDF·자동 저장·오류 안내
   ├─ 편집기 iframe (/studio/)  rhwp-studio v0.8.6, embed 프로필, 같은 출처에서 자체 호스팅
   ├─ 엔진 워커 (Web Worker)     @rhwp/core WASM: 저장 전 재파싱, 호환성 검사, 빈 문서 생성
   └─ IndexedDB                 자동 저장 임시 문서 (7일)
        │                    │
        ▼                    ▼
   Google Drive API     /api → Cloud Run (선택)
   (drive.file)            ├─ GET  /api/config        기능 플래그
                           ├─ GET  /api/me            역할 (서버가 판별)
                           ├─ POST /api/events        익명 운영 이벤트 (4KB 제한)
                           └─ GET  /api/admin/summary 집계 지표 (관리자)
                                 │
                                 ▼
                             Firestore: appConfig / users / events(TTL)
```

문서 파일은 크롬북과 사용자 Google Drive 에만 존재한다. API 에는 문서를 받는 엔드포인트가 없다 (테스트로 확인).

## 구성 요소

| 영역 | 위치 | 역할 |
|---|---|---|
| 편집기 | `apps/web/public/studio/` | rhwp-studio 를 태그 `v0.8.6` 에서 빌드. `?chrome=embed` 로 열면 편집기 자체의 열기·저장·인쇄 명령이 사라지고 앱이 문서 수명주기를 맡는다 |
| 편집기 래퍼 | `src/editor/editorSession.ts` | `@rhwp/editor` SDK 로 로드·내보내기·변경 감지·저장 완료 통지, Ctrl+S / Ctrl+P 연결 |
| 엔진 워커 | `src/engine/` | 편집기와 같은 WASM 파일을 재사용(중복 다운로드 없음). 제한 시간 초과 시 워커 종료 |
| 검사 | `src/validation/` | 시그니처 기반 형식 판별, ZIP 중앙 디렉터리 검사(ZIP bomb·이미지 수/크기), 저장 전 검증, 호환성 경고 |
| 문서 흐름 | `src/documents/documentService.ts` | 열기 → 검사 → 재파싱 → 편집기, 저장: 직렬화 → 검사 → 재파싱 → 쓰기 |
| Drive | `src/drive/` | REST v3 (`files.get`, `alt=media`, multipart 생성, media 갱신), Picker, 충돌 감지 |
| 인증 | `src/auth/` | Google Identity Services, ID 토큰 클레임 확인(iss/aud/exp/hd/sub), 역할 |
| 설정 | `src/config/flags.ts` | API → config.json → 마지막 값 → 기본값 순서로 기능 플래그 로드 |
| API | `apps/api/` | Hono on Cloud Run. ID 토큰 서명 검증(google-auth-library), 이벤트 허용 필드 검증, 사용자별 속도 제한 |

## 주요 흐름

### 열기 (UC-02, UC-03, UC-04)

1. 파일 선택 (로컬 File System Access API / 끌어다 놓기 / Drive Picker)
2. `inspectDocument`: 확장자, 시그니처, 크기(50MB), ZIP 압축 해제 크기(250MB)·압축률·이미지(200개, 20MB)
3. 엔진 워커에서 재파싱 + HWPX 저장 손실 보고서 + 글꼴 대체 정보 → 호환성 경고(FR-OPEN-003)
4. 편집기에 로드. 경고는 편집 화면 상단 배너로 표시

### 저장 (FR-SAVE-001~008)

1. 편집기에서 HWPX(기본) 또는 HWP(플래그가 켜진 경우) 바이트를 받는다
2. `validateForSave`: 비어 있지 않음 → 정적 검사 → 워커 재파싱 → 쪽 수 1 이상 (편집 화면과 쪽 수가 다르면 경고)
3. 통과한 경우에만 쓴다
   - Drive 기존 파일: 연 시점의 `headRevisionId` 와 현재 값을 비교, 다르면 덮어쓰지 않고 선택지 제시
   - Drive 새 파일: multipart 업로드 (Picker 로 고른 폴더 또는 내 드라이브)
   - 로컬: 원래 파일 핸들에 덮어쓰기 또는 저장 위치 선택
4. 편집기에 저장 완료 통지, 자동 저장 임시 문서 삭제

HWP 원본은 항상 저장 대화상자를 열고 HWPX 를 기본으로 제시한다 (UC-03). 형식이 바뀌면 원래 파일을 덮어쓰지 않고 새 파일로 저장한다.

### PDF (FR-PDF-003)

rHWP 브라우저 빌드는 PDF 를 만들지 않는다. 편집기에서 페이지별 SVG 를 받아 스크립트가 막힌 sandbox iframe 에 모으고 Chrome 인쇄 대화상자를 연다. 사용자는 대상으로 'PDF로 저장' 또는 'Google Drive에 저장'을 고른다. 편집기에 로드된 웹폰트를 인쇄 문서로 복사해 글꼴을 맞춘다.

### 오프라인 (FR-OFFLINE-001~004)

Workbox 서비스 워커가 앱 셸·편집기·엔진 WASM(약 10MB)을 설치 때 사전 캐시한다. 새 버전은 백그라운드에서 받고 다음 실행 때 적용한다(편집 중 새로고침 없음). `config.json` 은 네트워크 우선이다. 운영 빌드 오프라인 재실행은 `npm run test:e2e:prod` 로 검증한다.

## PRD 와 다르게 구현한 점

| PRD | 구현 | 이유 |
|---|---|---|
| 30장 `packages/editor, auth, drive, ui, shared` | `apps/web/src/` 아래 폴더로 분리 | 한 앱에서만 쓰는 코드라 npm 패키지 분리의 이득보다 빌드 설정 부담이 크다. 경계(Rule 1, 2)는 폴더로 유지 |
| 30장 `vendor/rhwp` | 로컬 캐시에서 빌드 (`scripts/build-studio.mjs`) | 학교 전용 패치가 아직 없다. 패치가 생기면 fork 로 전환 (PRD 28장, docs/rhwp-integration.md) |
| 10.3 Cloud Run 필수 | 선택 (백엔드 없이도 전체 기능 동작) | PRD v1.1 10.3 운영 규모 고려, FR-OFFLINE-002 |
