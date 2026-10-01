# 운영

## 담당 (PRD v1.1 37장)

| 역할 | 담당 | 비고 |
|---|---|---|
| 1차 담당 | 반곡고등학교 정보부장 | 배포, 기능 플래그, 장애 대응 |
| 대체 담당 | (지정) | 1차 담당 부재 시 |

## 기능 플래그 바꾸기 (PRD 20장)

| 플래그 | 기본값 | 끄면 |
|---|---|---|
| allowHwpOpen | 켜짐 | HWP 파일을 열지 않음 |
| allowHwpSave | **꺼짐** | HWP 호환 저장 선택 불가 |
| allowHwpxOpen | 켜짐 | HWPX 파일을 열지 않음 |
| allowHwpxSave | 켜짐 | HWPX 저장 불가 (보통 끄지 않음) |
| allowPdfExport | 켜짐 | PDF 버튼 숨김 |
| allowDriveIntegration | 켜짐 | Drive 열기·저장 불가, 로컬만 |
| maintenanceMode | 꺼짐 | 관리자 외 모든 사용자에게 점검 화면 |

- **구성 A (웹만)**: `apps/web/public/config.json` 을 고쳐 다시 배포한다. 크롬북은 앱을 열 때 네트워크 우선으로 새 값을 받는다.
- **구성 B (API)**: Firestore → `appConfig/current` 문서의 `flags` 필드를 고친다. 배포가 필요 없다.

API 와 config.json 을 모두 받지 못하면 크롬북은 마지막으로 받은 값, 그것도 없으면 내장 기본값으로 동작한다.

## 장애 대응

### 수업 중 대체 경로 (교사에게 미리 공지)

1. 저장이 안 되면: **다른 이름으로 저장 → 이 크롬북**으로 내려받은 뒤 Classroom 에 파일로 제출
2. 앱이 열리지 않으면: 앱을 완전히 닫고 다시 연다 (서비스 워커 캐시로 오프라인에서도 열림)
3. 문서가 열리지 않으면: 오류 코드를 적어 반곡고등학교 정보부에 전달, PDF 나 다른 형식으로 제출

### 오류 코드

| 코드 | 뜻 | 먼저 확인할 것 |
|---|---|---|
| AUTH_001 | 학교 계정 아님 | 개인 Gmail 로 로그인했는지 |
| AUTH_002/003 | 로그인 실패·만료 | 18세 미만 앱 접근 설정, OAuth 동의 화면 |
| DOC_001/002 | HWP 미지원·손상 | 한컴에서 열리는지, 익명화해 호환성 코퍼스에 추가 |
| DOC_003 | 파일 너무 큼 | 50MB, 이미지 200개·20MB 제한 |
| DOC_005 | 여는 시간 초과 | 문서 크기, 기기 성능 |
| SAVE_001/002 | 직렬화·검증 실패 | **원본은 보존됨**. 편집 내용은 자동 저장 복구 목록에 있음. 문서를 익명화해 rHWP 이슈로 보고 |
| SAVE_003 | Drive 저장 실패 | Drive 저장 공간, 네트워크 |
| SAVE_004 | Drive 충돌 | 다른 곳에서 같은 파일을 고침. 새 파일로 저장 권장 |
| DRIVE_003 | Drive 권한 없음 | 파일 공유 권한, 18세 미만 앱 접근 설정 |
| EDITOR_001 | 편집기 로드 실패 | 배포에 `studio/` 가 포함됐는지 (`npm run build:studio`) |

### 점검 모드

1. `maintenanceMode: true` (구성 A: config.json 배포, B: Firestore)
2. 관리자 계정은 점검 중에도 들어가 확인할 수 있다
3. 끝나면 `false` 로 되돌린다

### 이전 버전으로 되돌리기

`docs/deployment.md` 의 롤백 절차.

## 정기 점검

| 주기 | 할 일 |
|---|---|
| 매주 (Pilot 중) | 관리자 화면에서 파일 열기·저장 실패율, 주요 오류 코드 확인 |
| 매월 | rHWP 새 버전 확인 → `docs/compatibility.md` 업데이트 절차 |
| 학기 초 | 18세 미만 앱 접근 설정, PWA 강제 설치 OU, 관리자 목록 확인 |
| 학기 초 | 자동 저장·최근 문서는 기기에만 있으므로 공용 크롬북 초기화 정책 확인 |

## 졸업·전출자 기록 삭제 (docs/privacy.md)

운영 서버의 사용자 기록(`users/{sub}`)은 마지막 접속 후 1년이 지나면 Firestore TTL(`expireAt`)로 자동 삭제된다. 졸업·전출자는 접속이 끊기므로 따로 정리할 필요가 없다. 운영 이벤트에는 사용자 정보가 없고 90일 뒤 자동 삭제된다.

본인이 즉시 삭제를 요청하면 관리자는 요청자의 Google 계정 고유 ID(Directory API 의 사용자 `id`, ID 토큰의 `sub` 와 같은 값)를 확인해 Firestore `users/{그 ID}` 문서를 지운다. 고유 ID 는 관리 콘솔 사용자 상세나 `gam info user` 등으로 확인한다.

## 담당자가 바뀔 때

`apps/web/src/branding.json` 의 `developer`, `supportContact` 는 고치지 않아도 된다(최초 개발 연도 표기). 이후 기여자는 README 에 추가한다. 1차 담당 표만 새 담당자로 바꾼다.

## 백업 (PRD 38장)

- 애플리케이션 데이터: GitHub 저장소, Firestore 내보내기 (`gcloud firestore export`)
- 학생 문서: Google Drive 가 원본 저장소. 학교 서버에서 따로 백업하지 않는다.
