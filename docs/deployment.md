# 배포

## 구성 선택

| 구성 | 언제 | 필요한 것 |
|---|---|---|
| A. 웹만 (Firebase Hosting) | Phase 0~2 | Firebase Hosting, `config.json` 으로 기능 플래그 |
| B. 웹 + API (Firebase Hosting + Cloud Run + Firestore) | 운영 지표·서버 역할 판별이 필요할 때 | A + Cloud Run, Firestore, Artifact Registry |

앱은 두 구성 모두에서 같은 기능을 한다. B 는 관리자 화면의 운영 지표와 서버 측 역할 판별을 더한다.

## GitHub Pages (가장 간단한 방법)

Google Cloud 없이 GitHub 만으로 배포한다. `main` 에 올리면 `.github/workflows/pages.yml` 이 테스트 → 빌드 → 배포를 한다.

1. GitHub 저장소 → Settings → Pages → Source 를 **GitHub Actions** 로 바꾼다.
2. `main` 에 push 하거나 Actions → "GitHub Pages 배포" → Run workflow.
3. 주소: `https://<계정>.github.io/<저장소>/`. 학교 도메인을 쓰려면 저장소 변수 `PAGES_CUSTOM_DOMAIN` 에 도메인(예: `docs.bangok.hs.kr`)을 넣고 DNS 에 CNAME 을 추가한다.

| 저장소 변수 `VITE_GOOGLE_CLIENT_ID` | 배포되는 빌드 |
|---|---|
| 없음 | **검토용 빌드**: 로그인 생략, 화면에 '검토용 빌드' 표시, Drive 꺼짐 |
| 있음 (+ `VITE_GOOGLE_API_KEY`, `VITE_GOOGLE_APP_ID`) | 운영 빌드: 반곡고 Google 계정 로그인 필수 |

제약:

- 무료 GitHub 계정에서는 **공개 저장소만** Pages 를 쓸 수 있다. 비공개 저장소는 GitHub Pro/Team(교육용 무료 혜택 포함)이 필요하다.
- 검토용 빌드는 주소를 아는 누구나 열 수 있다. 문서는 각자의 브라우저에서만 처리되므로 학교 데이터가 노출되지는 않지만, 학생 배포 전에는 Google 로그인 변수를 넣어 운영 빌드로 바꾼다.
- 응답 헤더를 지정할 수 없어 보안 정책(CSP)을 HTML 메타 태그로 넣는다(`scripts/prepare-pages.mjs`). `frame-ancestors` 는 메타 태그로 동작하지 않는다 (docs/security.md).
- Google OAuth 클라이언트의 '승인된 JavaScript 원본'에 `https://<계정>.github.io` 를 추가해야 운영 빌드 로그인이 된다.

## 사전 준비 (한 번)

1. `docs/google-workspace-integration.md` 1~6단계
2. Firebase: 같은 GCP 프로젝트에 Firebase 를 연결하고 Hosting 사이트를 만든다. 사용자 도메인 `docs.bangok.hs.kr` 연결.
3. (B) Firestore 네이티브 모드 생성, 리전 `asia-northeast3`(서울)
4. (B) Firestore TTL 정책 두 개: 컬렉션 `events` 필드 `expireAt`(90일), 컬렉션 `users` 필드 `expireAt`(마지막 접속 후 1년)
5. (B) Artifact Registry 저장소 `school-hwp` (Docker, `asia-northeast3`)
6. (B) Cloud Run 로그 보존: 로그 라우터의 `_Default` 버킷 보존 기간 30일 (SEC-009)
7. GitHub → Google Cloud 키 없는 인증 (Workload Identity Federation) 과 배포용 서비스 계정. 역할: Firebase Hosting 관리자, Cloud Run 관리자, Artifact Registry 작성자, 서비스 계정 사용자
8. GitHub 저장소 → Settings → Environments 에 `development`, `staging`, `production` 을 만들고 변수 등록 (목록은 `.github/workflows/deploy.yml` 머리말). production 은 승인자 지정

`firebase.json` 의 Cloud Run 리전(`asia-northeast3`)과 서비스 이름(`school-hwp-api`)이 실제 값과 같아야 한다. 구성 A 에서는 `/api/**` rewrite 를 지워도 되고 그대로 둬도 된다(`VITE_API_BASE` 가 비어 있으면 호출하지 않음).

## 배포 절차

GitHub → Actions → **Deploy** → Run workflow → 환경 선택. 워크플로는 편집기 빌드 → 타입 검사·단위 테스트 → 호환성 테스트 → 빌드 → (API 이미지 빌드·배포) → Hosting 배포 순서로 진행하고, 앞 단계가 실패하면 멈춘다.

로컬에서 직접 배포할 때:

```bash
npm ci
npm run build:studio
cp apps/web/.env.example apps/web/.env.production.local   # 운영 값 채우기, VITE_DEV_AUTH_BYPASS 는 비워 둔다
npm run verify
npx firebase-tools deploy --only hosting --project <프로젝트ID>
```

## 단계별 배포 (PRD 21장)

| Phase | 대상 OU | 사용자 | 넘어가는 조건 |
|---|---|---|---|
| 0 | 개발자 | 1~3 | Sprint 0 Spike 완료 (PRD 46장) |
| 1 | 교직원 Pilot | 5~10 | 실제 문서 호환성 결과 기록 |
| 2 | 학생 Pilot | 30~50 | 18세 미만 앱 접근 설정 확인, 2주 사용 |
| 3 | 학년 | 150~250 | PRD 42장 Go/No-Go 전 항목 |
| 4 | 전체 | 약 700 | |

## 롤백

- Hosting: Firebase 콘솔 → Hosting → 출시 기록 → 이전 버전 '롤백'. 서비스 워커는 다음 실행 때 이전 버전으로 바뀐다.
- API: Cloud Run → 수정 버전 → 이전 버전으로 트래픽 100%.
- 급할 때: 기능 플래그로 문제 기능만 끈다 (docs/operations.md).
