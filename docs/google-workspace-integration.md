# Google Workspace 연동 설정

학교 Workspace 관리자 계정과 Google Cloud 프로젝트 소유자 권한이 필요하다. 아래 값은 `apps/web/.env.local` (개발) 또는 배포 워크플로의 GitHub 변수(운영)에 넣는다.

## 1. Google Cloud 프로젝트

1. https://console.cloud.google.com 에서 학교 조직 아래 새 프로젝트를 만든다 (예: `school-docs`).
2. 프로젝트 번호를 적어 둔다 → `VITE_GOOGLE_APP_ID`
3. API 사용 설정: **Google Drive API**, **Google Picker API**. 백엔드를 쓰면 **Cloud Run**, **Firestore**, **Artifact Registry** 도.

## 2. OAuth 동의 화면

- 사용자 유형: **내부(Internal)** ← 학교 도메인 밖 계정을 Google 이 차단한다 (FR-AUTH-002 의 1차 방어선)
- 앱 이름: 반곡고 문서 편집기 (한컴 상표를 앱 이름에 쓰지 않는다, PRD 8.3, docs/legal-review.md 4절)
- 사용자 지원 이메일: 반곡고등학교 정보부 담당자 계정
- 범위: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/drive.file` 만 추가 (drive 전체 범위 금지)
- 승인된 도메인: 편집기 도메인 (예: `docs.bangok.hs.kr`)

## 3. OAuth 클라이언트 ID

- 유형: 웹 애플리케이션
- 승인된 JavaScript 원본: `https://docs.bangok.hs.kr`, 개발용 `http://127.0.0.1:5173`
- 리디렉션 URI: 필요 없음 (팝업·One Tap 방식)
- 클라이언트 ID → `VITE_GOOGLE_CLIENT_ID` (공개 값). 클라이언트 보안 비밀은 이 앱에서 쓰지 않는다.

## 4. Picker API 키

- API 키를 만들고 제한한다: 애플리케이션 제한 = HTTP 리퍼러 (`https://docs.bangok.hs.kr/*`, 개발 시 `http://127.0.0.1:5173/*`), API 제한 = Google Picker API
- 키 → `VITE_GOOGLE_API_KEY`

## 5. 학교 도메인

- 기본값은 `bangok.hs.kr` (`apps/web/src/branding.json`). 다른 도메인으로 시험할 때만 `VITE_ALLOWED_DOMAIN` 으로 바꾼다. ID 토큰의 `hd` 값과 같아야 한다.

## 6. 18세 미만 사용자 앱 접근 설정 (필수, PRD v1.1 22장)

Google Workspace for Education 은 18세 미만으로 지정된 사용자가 설정되지 않은 서드파티 앱에 접근하는 것을 기본 차단한다. 이 설정이 없으면 학생 로그인과 Drive 연동이 막힌다.

```text
관리 콘솔 → 보안 → 액세스 및 데이터 제어 → API 제어 → 앱 액세스 제어
→ 앱 관리 → 3번의 OAuth 클라이언트 ID 로 앱 검색 → 액세스 구성 → '신뢰함'
```

- 먼저 Pilot 학생 OU 에만 적용한다.
- 보호자 동의가 필요한지 학교가 관련 법령과 학교 방침을 확인한다.
- 학생 테스트 계정으로 로그인 → Drive에서 열기 → Drive 저장까지 확인한다.

## 7. PWA 강제 설치 (PRD 22장)

```text
관리 콘솔 → 기기 → Chrome → 앱 및 확장 프로그램 → 사용자 및 브라우저
→ 대상 OU 선택 (처음에는 학생/Pilot) → ＋ → URL로 추가
→ https://docs.bangok.hs.kr/ → 설치 정책: 강제 설치 + 고정(Pin to taskbar)
```

## 8. 로컬 개발에서 실제 Google 로그인 시험

```bash
cp apps/web/.env.example apps/web/.env.local   # 값 채우기, VITE_DEV_AUTH_BYPASS=false
npm run dev                                     # http://127.0.0.1:5173
```

`VITE_GOOGLE_CLIENT_ID` 와 `VITE_ALLOWED_DOMAIN` 이 있으면 개발 서버에서도 실제 Google 로그인을 쓴다.
