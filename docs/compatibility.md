# 호환성 검사 (PRD 16~19장)

## 무엇을 확인하나

`npm run test:compat` 은 각 문서에 대해 다음을 확인한다.

| 검사 | 의미 | 필수 |
|---|---|---|
| open | 열리고 1쪽 이상 | 예 |
| hwpxReopen | HWPX 로 저장한 파일이 다시 열림 | 예 |
| hwpxTextPreserved | 저장 전후 본문·표 셀 텍스트가 같음 | 예 |
| hwpxStable | 저장 → 열기 → 저장을 반복해도 텍스트가 같음 (serializer 안정성) | 예 |
| hwpxPagesPreserved | 쪽 수가 같음 | 참고 |
| hwp* | HWP 호환 저장 경로의 같은 검사 | 참고 (HWP 저장은 기본 꺼짐) |
| hwpxLossCount | rHWP 가 보고한 저장 시 손실 요소 수 | 참고 |

보고서는 `tests/compatibility/report/compat-<rHWP버전>.json` 에 남는다. 본문 텍스트는 넣지 않고 해시만 기록한다.

Node 에서는 브라우저의 글자 폭 측정 대신 근사값을 쓰므로 **쪽 나눔 비교는 참고용**이다. 레이아웃은 아래 시각 비교로 확인한다.

## 문서 모으기

- `tests/fixtures/synthetic/`: `npm run fixtures:generate` 가 만드는 합성 문서 (글, 표, 여러 쪽 × HWPX/HWP). 저장소에 포함.
- `tests/fixtures/private/`: 실제 학교 문서를 **익명화한 뒤** 넣는다. 저장소에 올라가지 않는다(gitignore).

PRD 16장 분류별로 100~300개를 목표로 모은다: 일반 문서, 과제 양식, 표 중심 활동지, 이미지 포함, 글상자, 머리말·꼬리말, 쪽번호, 다단, 수식, 복잡한 표, 여러 쪽.

### 익명화 방법

1. 한컴오피스에서 원본을 연다.
2. 학생 이름·학번·연락처·서명을 같은 길이의 가짜 값으로 바꾼다 (길이를 바꾸면 레이아웃 비교가 틀어진다).
3. 사진은 같은 크기의 단색 이미지로 바꾼다.
4. 문서 정보(작성자, 회사)를 지운다.
5. 파일 이름을 분류-순번 형식으로 바꾼다 (예: `표중심-012.hwpx`).

## 시각 비교 (PRD 18장)

자동화 전 단계의 수동 절차:

1. 한컴오피스에서 원본을 PDF 로 저장 → `기준.pdf`
2. 반곡고 문서 편집기에서 같은 문서를 열어 PDF로 내보내기 → `생성.pdf`
3. 쪽 수, 줄바꿈, 표, 이미지 위치를 나란히 비교해 `tests/fixtures/private/visual-log.csv` 에 기록 (양식은 tests/fixtures/README.md)

기준 PDF 생성에는 학교 보유 한컴오피스 라이선스가 필요하다. 픽셀 비교 자동화와 허용 오차는 Phase 1 결과를 보고 정한다 (PRD v1.1 18장).

## 성공 기준 (PRD 41장)

| 지표 | 목표 | 측정 |
|---|---|---|
| 문서 열기 성공률 | ≥ 95% | 보고서 `openSuccessRate` (private 코퍼스 기준) |
| HWPX 재열기 성공률 | ≥ 99% | 보고서 `hwpxReopenRate` |
| 심각한 문서 손상 | 0건 | hwpxTextPreserved 실패 + 한컴 재열기 실패 |

## rHWP 를 올릴 때

1. `apps/web/package.json` 의 `@rhwp/core`, `@rhwp/editor` 를 같은 새 버전으로 바꾸고 `npm install`
2. `npm run build:studio`
3. `npm run test:compat` → 이전 버전 보고서와 비교 (통과 수가 줄면 올리지 않는다)
4. `npm run test:e2e && npm run test:e2e:prod`
5. staging 에 배포해 Pilot 교사가 실제 문서로 확인
6. `docs/rhwp-integration.md` 의 버전 기록에 결과를 적는다
