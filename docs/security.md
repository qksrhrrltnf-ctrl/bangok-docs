# 보안

## 데이터 원칙 (PRD 27장)

| 데이터 | 위치 | 비고 |
|---|---|---|
| 학생 문서 | 크롬북, 사용자 Google Drive | 서버 전송 없음. API 에 업로드 엔드포인트 없음, 요청 본문 4KB 제한 |
| 자동 저장 임시 문서 | 크롬북 IndexedDB | 사용자(sub)별, 7일 후 삭제, 로그아웃 시 삭제 선택 |
| 최근 문서 목록 | 크롬북 localStorage | Drive 파일 ID 와 이름만 |
| Drive 접근 토큰 | 메모리 | 저장소에 쓰지 않음, 로그아웃 시 폐기 |
| 사용자 | Firestore `users/{sub}` | role, createdAt, lastLoginAt. 이메일 저장 안 함. 마지막 접속 후 1년 TTL 삭제 |
| 운영 이벤트 | Firestore `events` | 허용 필드만. 사용자 식별자·파일 이름·내용 없음. `expireAt` TTL (기본 90일) |

## 인증 (FR-AUTH-001~006)

- **도메인 차단의 1차 방어선은 Google 이다.** Google Cloud 의 OAuth 동의 화면을 **내부(Internal)** 로 설정하면 학교 Workspace 밖의 계정은 로그인 자체가 안 된다.
- 브라우저는 ID 토큰의 iss / aud / exp / hd / sub 를 확인한다 (화면 진입 판단).
- API 는 `google-auth-library` 로 서명까지 검증하고 `hd` 를 다시 확인한다.
- 사용자 식별자는 이메일이 아니라 `sub` 다.
- 역할: 백엔드가 있으면 서버가 `ADMIN_EMAILS`, `TEACHER_EMAILS`, `TEACHER_EMAIL_PATTERN` 으로 판별한다. 백엔드가 없으면 `config.json` 의 목록을 쓰는데, 이 파일은 공개되므로 **교직원 이메일 목록 대신 패턴을 권장**한다. 클라이언트 역할은 화면 표시용일 뿐이고 권한이 필요한 동작(관리자 지표)은 서버가 다시 검사한다.

## Google 권한

- Drive 범위는 `drive.file` 하나 (SEC-004). 앱이 만든 파일과 사용자가 Picker 로 고른 파일만 접근한다.
- Domain-wide Delegation 사용 안 함 (SEC-005).
- Picker API 키는 HTTP 리퍼러(학교 편집기 주소)와 Picker API 로 제한한다.

## 입력 방어 (SEC-008)

| 공격 | 방어 |
|---|---|
| ZIP bomb | 중앙 디렉터리의 압축 해제 크기 합(250MB), 항목 수(1만), 항목별 압축률(200:1, 10MB 이상), ZIP64 거부 |
| 과대 이미지 | BinData 이미지 200개, 개별 20MB |
| 과대 문서 | 50MB. Drive 파일은 내려받기 전에 메타데이터 크기로 거부 |
| malformed XML/OLE, parser crash | 엔진 워커에서 먼저 파싱. 예외는 DOC_002 로 변환 |
| 무한 루프·메모리 고갈 | 워커 45초 제한, 초과 또는 워커 오류 시 워커 종료 후 재생성 |
| 문서 내 스크립트 (PDF 인쇄) | sandbox iframe(스크립트 불가), script/foreignObject/on* 속성 제거 |

## 브라우저 보안 헤더

단일 출처는 저장소 루트 `firebase.json`. 로컬 미리보기(`vite preview`)도 같은 값을 읽는다.

- `script-src 'self' 'wasm-unsafe-eval'` + Google 로그인·Picker 도메인. 인라인 스크립트 불가.
- `frame-ancestors 'self'`: 편집기(/studio/)를 다른 사이트가 iframe 으로 품지 못한다. rhwp-studio 의 embed 런타임은 부모 출처를 제한하지 않으므로 이 헤더가 필요하다.
- `font-src` / `connect-src` 의 `cdn.jsdelivr.net`: 편집기가 대체 웹폰트를 받는 곳 (docs/fonts.md). 폰트를 자체 호스팅하면 제거한다.
- CSP 위반이 없는지는 `npm run test:e2e:prod` 가 앱과 편집기 iframe 모두에서 확인한다.

### 알려진 위험: 편집기와 앱이 같은 출처

편집기 iframe 은 앱과 같은 출처라 편집기 렌더러에 XSS 취약점이 생기면 앱의 메모리(Drive 토큰 등)에 접근할 수 있다. 완화: 기본 렌더러가 canvas2d(문서 내용을 HTML 로 넣지 않음), 엄격한 CSP(인라인 스크립트 차단), 버전 고정과 업데이트 전 검증. 더 강하게 하려면 편집기를 별도 출처(예: `studio.docs.bangok.hs.kr`)로 옮기고 `STUDIO_URL` 과 엔진 WASM 경로를 바꾼다 (Phase 3 이전 검토 권장).

## 로그 (SEC-006, SEC-009)

- API 오류 로그에는 메시지와 경로만 남기고 요청 본문을 남기지 않는다.
- Cloud Run 요청 로그는 IP·User-Agent 를 자동 기록한다. URL 에 파일 이름·이메일을 넣지 않는다. 로그 버킷 보존 기간을 30일로 설정한다 (docs/deployment.md).
- 개인정보 처리 안내에 자동 수집 항목(IP 주소 등)을 포함한다.

## 개발 도구 (SEC-010)

익명화하지 않은 학교 문서는 저장소에 넣지 않고 Claude Code 등 외부 AI 도구에도 보여 주지 않는다. `tests/fixtures/private/` 는 gitignore 되어 있으며, 호환성 보고서에는 파일 이름 대신 순번이 기록된다.
