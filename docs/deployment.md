# 배포

## 구성 선택

| 구성 | 언제 | 필요한 것 |
|---|---|---|
| A. 웹만 (Firebase Hosting) | Phase 0~2 | Firebase Hosting, `config.json` 으로 기능 플래그 |
| B. 웹 + API (Firebase Hosting + Cloud Run + Firestore) | 운영 지표·서버 역할 판별이 필요할 때 | A + Cloud Run, Firestore, Artifact Registry |

앱은 두 구성 모두에서 같은 기능을 한다. B 는 관리자 화면의 운영 지표와 서버 측 역할 판별을 더한다.

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
