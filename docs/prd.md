# School HWP Editor PRD
## Google Workspace 기반 ChromeOS 학교용 HWP/HWPX 문서 편집 시스템

- 문서 버전: v1.1
- 작성일: 2026-09-28
- 대상 조직: Google Workspace for Education 기반 학교
- 예상 사용자 수: 약 700명
- 주 사용 기기: 관리형 Chromebook / ChromeOS
- 개발 환경: Claude Code Max 활용
- 핵심 문서 엔진: rHWP 기반 Rust/WASM
- 기본 문서 포맷: HWPX
- 상태: 구현 착수용 PRD (v1.1 검토 반영, 부록 A 변경 이력 참조)

---

# 1. 제품 개요

## 1.1 배경

학교는 Google Workspace for Education과 관리형 Chromebook을 사용하고 있으나, 학생들이 과제 제출 과정에서 HWP/HWPX 문서를 작성하거나 수정해야 하는 상황이 존재한다.

ChromeOS에서는 Windows용 한컴오피스 HWP 프로그램을 정식 설치하기 어렵고, Linux 컨테이너나 비공식 Android 앱을 학생 전체에 배포하는 방식은 관리 복잡도, 보안, 업데이트, 성능, 사용자 지원 측면에서 적합하지 않다.

따라서 학교 구성원이 Chromebook에서 별도 프로그램 설치 없이 사용할 수 있는 웹 기반 문서 편집 시스템을 구축한다.

본 시스템은 오픈소스 rHWP를 핵심 문서 엔진으로 활용하고, Google Workspace 인증, Google Drive, ChromeOS PWA 관리 배포를 결합하여 학교 전용 HWP/HWPX 편집 환경을 제공한다.

---

# 2. 제품 비전

학교 구성원이 Chromebook에서 다음 흐름을 자연스럽게 수행할 수 있는 환경을 제공한다.

```text
Chromebook 로그인
    ↓
학교 문서 편집기 실행
    ↓
새 문서 작성 또는 HWP/HWPX 열기
    ↓
브라우저에서 편집
    ↓
HWPX / HWP / PDF 저장
    ↓
Google Drive 저장
    ↓
Google Classroom 과제 첨부 또는 제출
```

제품의 핵심 원칙은 다음 세 가지다.

1. **HWPX-first**
   - 신규 문서는 HWPX를 기본 포맷으로 사용한다.
   - HWP는 호환 포맷으로 지원한다.

2. **Local-first**
   - 문서 파싱, 렌더링, 편집, 직렬화는 가능한 한 브라우저에서 처리한다.
   - 서버는 학생 문서 본문을 저장하지 않는 것을 기본 원칙으로 한다.

3. **Google Workspace-native**
   - Google Workspace 계정으로 인증한다.
   - Google Drive와 연동한다.
   - Chrome Admin Console을 통해 관리형 Chromebook에 배포한다.

---

# 3. 목표

## 3.1 핵심 목표

### G1. ChromeOS에서 HWP/HWPX 작성 환경 제공

학생과 교직원이 Chromebook에서 별도 로컬 프로그램 설치 없이 HWP/HWPX 문서를 열고 편집할 수 있어야 한다.

### G2. HWPX 중심 문서 작성

새 문서 작성 시 HWPX를 기본 저장 포맷으로 제공한다.

### G3. Google Drive 연동

사용자가 자신의 Google Drive에서 문서를 열고 저장할 수 있어야 한다.

### G4. Google Workspace 인증

학교 Workspace 계정으로만 서비스에 접근할 수 있어야 한다.

### G5. 관리자 일괄 배포

Google Admin Console에서 학생 또는 교직원 OU에 PWA를 강제 설치할 수 있어야 한다.

### G6. 학교 규모 운영

약 700명의 학교 구성원이 안정적으로 사용할 수 있어야 한다.

### G7. 문서 데이터 최소 수집

학생 문서 본문은 서비스 자체 서버나 DB에 저장하지 않는 구조를 우선한다.

### G8. 안전한 저장

문서 저장 시 생성 파일의 유효성을 검증하고, 저장 실패 시 기존 문서를 보호해야 한다.

---

# 4. 비목표

초기 버전에서는 다음 기능을 구현하지 않는다.

- Google Docs 수준의 실시간 공동 편집
- 완전한 한컴오피스 기능 복제
- NEIS/업무관리시스템 직접 연동
- 한컴오피스와 100% 동일한 조판 보장
- 모든 HWP 기능 지원
- AI 문서 자동 작성
- AI 문서 요약/첨삭
- Google Classroom API를 통한 직접 과제 제출
- 모바일 전용 앱
- Windows/macOS 네이티브 앱
- 조직 전체 Drive 검색
- Domain-wide Delegation
- 관리자에 의한 학생 문서 열람 기능

이 기능들은 필요성이 검증된 후 별도 버전에서 검토한다.

---

# 5. 대상 사용자

## 5.1 학생

주요 요구:

- 학교 Chromebook에서 문서를 작성하고 싶다.
- HWP/HWPX 파일을 열고 수정하고 싶다.
- 교사가 제공한 HWP/HWPX 활동지를 작성하고 싶다.
- 작성한 문서를 Drive 또는 Chromebook에 저장하고 싶다.
- Classroom 과제에 제출할 수 있는 파일을 만들고 싶다.

예상 사용자 수:

- 약 600~650명

---

## 5.2 교직원

주요 요구:

- 학생에게 HWP/HWPX 활동지를 배포하고 싶다.
- 학생이 제출한 HWP/HWPX 파일을 확인하고 싶다.
- ChromeOS에서도 간단한 HWP/HWPX 문서 편집이 필요하다.

예상 사용자 수:

- 약 50~100명

---

## 5.3 시스템 관리자

주요 요구:

- Google Workspace 계정 기반으로 사용자를 통제하고 싶다.
- 학생 OU에 앱을 강제 설치하고 싶다.
- 장애 상황을 확인하고 싶다.
- 특정 기능을 비활성화할 수 있어야 한다.
- 새 버전을 소규모 사용자에게 먼저 배포하고 싶다.
- 문서 본문에 접근하지 않고도 시스템 상태를 파악하고 싶다.

---

# 6. 핵심 사용자 시나리오

## UC-01 새 문서 작성

1. 사용자가 PWA를 실행한다.
2. Google Workspace 계정으로 자동 인증된다.
3. 메인 화면에서 `새 문서`를 선택한다.
4. 빈 HWPX 문서가 생성된다.
5. 사용자가 텍스트와 표 등을 작성한다.
6. `Drive에 저장`을 선택한다.
7. 파일명과 Drive 위치를 선택한다.
8. HWPX 파일이 Drive에 저장된다.

---

## UC-02 Chromebook에서 HWPX 파일 열기

1. 사용자가 `파일 열기`를 선택한다.
2. 로컬 파일에서 `.hwpx` 파일을 선택한다.
3. 브라우저의 rHWP WASM 엔진에서 문서를 파싱한다.
4. 문서가 화면에 렌더링된다.
5. 사용자가 문서를 수정한다.
6. HWPX로 저장한다.

---

## UC-03 기존 HWP 파일 열기

1. 사용자가 `.hwp` 파일을 선택한다.
2. 시스템이 HWP 파일을 파싱한다.
3. 지원되지 않는 요소가 발견되면 사용자에게 경고한다.
4. 편집 가능한 요소를 수정한다.
5. 저장 시 HWPX 저장을 기본 선택으로 제시한다.
6. 필요 시 HWP 저장도 제공한다.

---

## UC-04 Google Drive에서 파일 열기

1. 사용자가 `Drive에서 열기`를 선택한다.
2. Google Picker가 열린다.
3. 사용자가 접근 권한이 있는 HWP/HWPX 파일을 선택한다.
4. 파일이 브라우저에 로드된다.
5. rHWP에서 편집한다.
6. 변경된 파일을 Drive에 다시 저장한다.

---

## UC-05 PDF 제출본 생성

1. 사용자가 문서를 작성한다.
2. `PDF로 내보내기`를 선택한다.
3. PDF가 생성된다.
4. 로컬 다운로드 또는 Drive 저장이 가능하다.

참고: Google Classroom과 Drive는 HWPX 파일을 미리보기로 표시하지 못한다. 교사가 Classroom에서 바로 채점할 수 있도록 과제 제출 시 HWPX 원본과 PDF를 함께 제출하는 흐름을 권장 안내로 제공한다.

---

# 7. 기능 요구사항

# 7.1 인증

## FR-AUTH-001

Google Workspace 계정으로 로그인할 수 있어야 한다.

## FR-AUTH-002

학교 도메인 계정만 로그인할 수 있어야 한다.

## FR-AUTH-003

ID Token 검증 시 다음을 확인해야 한다.

- issuer
- audience
- expiration
- `hd` claim
- `sub`

## FR-AUTH-004

내부 사용자 식별자는 이메일 주소가 아니라 Google `sub` 값을 사용한다.

## FR-AUTH-005

로그아웃 기능을 제공한다.

## FR-AUTH-006

사용자 역할(student / teacher / admin)은 다음 방식 중 하나로 판별한다. Domain-wide Delegation과 Admin SDK 조회는 사용하지 않는다.

1. 계정 이메일 규칙 기반 판별 (학생·교직원 계정에 구분 가능한 규칙이 있는 경우)
2. 관리자가 등록한 교직원·관리자 허용 목록

기본값은 `student`이며, `teacher`와 `admin` 권한은 허용 목록에 있는 경우에만 부여한다. 판별 방식은 Sprint 0에서 학교 계정 체계를 확인한 뒤 확정한다.

---

# 7.2 문서 생성

## FR-DOC-001

사용자는 새 HWPX 문서를 만들 수 있어야 한다.

## FR-DOC-002

새 문서의 기본 파일 형식은 HWPX로 한다.

## FR-DOC-003

기본 페이지 크기는 A4로 한다.

## FR-DOC-004

다음 기본 편집 기능을 제공해야 한다.

- 텍스트 입력
- 삭제
- 복사
- 붙여넣기
- 실행 취소
- 다시 실행
- 글꼴
- 글자 크기
- 굵게
- 기울임
- 밑줄
- 글자 정렬
- 문단 정렬
- 줄 간격
- 표 삽입
- 표 셀 편집

---

# 7.3 파일 열기

## FR-OPEN-001

다음 파일 확장자를 열 수 있어야 한다.

- `.hwp`
- `.hwpx`

## FR-OPEN-002

파일 열기 방식은 다음을 지원한다.

- 로컬 파일 선택
- Drag & Drop
- Google Drive Picker

## FR-OPEN-003

지원되지 않는 문서 요소가 발견되는 경우 명확한 경고 메시지를 제공해야 한다.

예:

```text
이 문서에는 현재 편집기에서 완전히 지원하지 않는 요소가 포함되어 있습니다.
저장 시 일부 레이아웃이 달라질 수 있습니다.
```

---

# 7.4 문서 저장

## FR-SAVE-001

다음 저장 방식을 지원한다.

- Chromebook 로컬 다운로드
- Google Drive 저장

## FR-SAVE-002

기본 저장 포맷은 HWPX로 한다.

## FR-SAVE-003

추가 저장 형식으로 다음을 지원할 수 있다.

- HWP
- PDF

## FR-SAVE-004

HWP 저장은 `호환 저장`으로 표시한다.

## FR-SAVE-005

저장 전에 생성된 문서를 다시 파싱하여 파일 유효성을 검증한다.

```text
편집
  ↓
serialize
  ↓
validation
  ↓
reparse
  ↓
성공
  ↓
실제 저장
```

## FR-SAVE-006

파일 검증 실패 시 기존 Drive 파일을 덮어쓰지 않는다.

## FR-SAVE-007

기존 Drive 파일을 덮어쓰기 전에 파일을 연 시점의 `headRevisionId`(또는 `modifiedTime`)와 현재 값을 비교한다. 값이 다르면 다른 사용자나 기기에서 파일이 변경된 것으로 보고 덮어쓰지 않는다.

이 경우 사용자에게 다음 선택지를 제공한다.

- 새 파일로 저장 (Save As)
- 다른 변경 사항을 무시하고 덮어쓰기 (명시적 확인 필요)
- 취소

## FR-SAVE-008

Drive 파일 갱신은 Drive 버전 기록이 남는 방식으로 수행한다. 저장 후 문제가 발견되어도 사용자가 Drive 버전 기록에서 이전 버전을 복구할 수 있어야 한다.

---

# 7.5 Google Drive

## FR-DRIVE-001

Google Picker API를 통해 파일을 선택할 수 있어야 한다.

## FR-DRIVE-002

가능한 최소 OAuth Scope를 사용한다.

권장:

```text
drive.file
```

## FR-DRIVE-003

앱이 생성하거나 사용자가 명시적으로 선택한 파일만 접근하는 구조를 우선한다.

## FR-DRIVE-004

기존 Drive 파일 저장 시 파일 ID를 유지하면서 업데이트할 수 있어야 한다.

## FR-DRIVE-005

Save As 기능을 제공한다.

---

# 7.6 PDF

## FR-PDF-001

현재 문서를 PDF로 내보낼 수 있어야 한다.

## FR-PDF-002

PDF 출력 결과는 화면 렌더링과 가능한 한 동일해야 한다.

## FR-PDF-003

PDF는 브라우저에서 생성한다. 서버 측 PDF 변환은 문서 본문이 서버로 전송되므로 Local-first 원칙에 따라 금지하며, 필요하면 별도 아키텍처 승인을 받는다.

참고: 2026-09 기준 rHWP의 PDF 내보내기는 네이티브 CLI(`rhwp export-pdf`)에서만 제공되고, WASM/npm 빌드는 SVG 렌더링까지 제공한다. 따라서 다음 중 하나를 Sprint 0 기술 검증에서 선택한다.

1. rHWP SVG 렌더링 결과로 인쇄 전용 뷰를 구성하고 Chrome 인쇄 대화상자의 `PDF로 저장` 사용
2. rHWP SVG 렌더링 결과를 클라이언트 라이브러리(예: jsPDF + svg2pdf.js)로 PDF 변환
3. rHWP의 PDF 경로를 WASM 빌드에 포함 (fork 패치 또는 upstream 기여)

1안은 구현이 가장 단순하지만 Drive 직접 저장이 어렵다. 2안은 한글 폰트 임베딩 검증이 필요하다. 3안은 fork 유지 부담이 커진다.

---

# 7.7 자동 저장

로컬 임시 저장은 V1 필수 기능이다(39장). Drive 자동 저장은 V1에서 제외한다.

권장 방식:

```text
browser IndexedDB
```

자동 저장 데이터는 서버에 전송하지 않는다.

## FR-AUTOSAVE-001

편집 중 일정 시간 간격으로 로컬 임시 저장한다.

## FR-AUTOSAVE-002

브라우저 비정상 종료 후 임시 문서를 복구할 수 있어야 한다.

## FR-AUTOSAVE-003

Drive 자동 덮어쓰기는 기본 비활성화한다.

## FR-AUTOSAVE-004

로그아웃 시 해당 사용자의 IndexedDB 임시 저장 데이터 삭제 여부를 확인한다. 복구되지 않은 임시 문서는 일정 기간(예: 7일) 후 자동 삭제한다.

---

# 7.8 오프라인 및 백엔드 장애 동작

## FR-OFFLINE-001

앱 셸과 rHWP WASM 번들은 Service Worker로 캐시한다. 최초 설치 이후에는 네트워크 없이도 앱을 실행할 수 있어야 한다.

## FR-OFFLINE-002

백엔드에 접근할 수 없어도 문서 열기, 편집, 로컬 저장, 자동 저장은 동작해야 한다. 이때 기능 플래그는 마지막으로 받은 값 또는 앱에 내장된 기본값을 사용한다.

## FR-OFFLINE-003

네트워크가 끊긴 상태에서 Drive 저장을 시도하면 실패를 명확히 알리고 로컬 다운로드를 대안으로 제시한다.

## FR-OFFLINE-004

수업 시작 시 여러 기기가 동시에 앱을 여는 상황을 고려한다. WASM 번들 크기를 측정하고, 새 버전은 백그라운드에서 받아 다음 실행 때 적용하는 캐시 갱신 전략을 정의한다.

---

# 7.9 한글 입력

## FR-IME-001

ChromeOS 한글 입력기로 조합 입력(자모 조합, 조합 중 커서 이동, 백스페이스)이 정상 동작해야 한다.

## FR-IME-002

표 셀 내부, 문단 경계, 실행 취소 직후 같은 경계 상황에서도 조합 중인 글자가 유실되거나 중복 입력되지 않아야 한다.

## FR-IME-003

한글 입력 검증은 Chromebook 실제 기기에서 수행하고, E2E 테스트에 조합 입력 시나리오를 포함한다.

---

# 8. UI 요구사항

# 8.1 메인 화면

최소 구성:

```text
┌─────────────────────────────────────┐
│ 학교 문서 편집기                    │
├─────────────────────────────────────┤
│                                     │
│  새 문서                            │
│                                     │
│  파일 열기                          │
│                                     │
│  Drive에서 열기                     │
│                                     │
│  최근 문서                          │
│                                     │
└─────────────────────────────────────┘
```

---

# 8.2 편집 화면

```text
┌─────────────────────────────────────────────────────┐
│ 파일명                    저장 상태        사용자    │
├─────────────────────────────────────────────────────┤
│ 파일  편집  보기  삽입                            │
├─────────────────────────────────────────────────────┤
│ 글꼴 | 크기 | B | I | U | 정렬 | 표 | ...        │
├─────────────────────────────────────────────────────┤
│                                                     │
│                   문서 페이지                       │
│                                                     │
│                                                     │
├─────────────────────────────────────────────────────┤
│ 페이지 / 확대축소 / 저장상태                       │
└─────────────────────────────────────────────────────┘
```

---

# 8.3 ChromeOS UX

PWA 설치 후 앱 이름:

```text
학교 문서 편집기
```

권장 아이콘:

- 학교 CI 기반
- HWP/HWPX 상표를 직접 앱 이름으로 사용하지 않음

---

# 9. 시스템 아키텍처

```text
                 Google Workspace
                        │
                 Google Identity
                        │
                        ▼
┌─────────────────────────────────────────────┐
│           Managed Chromebook                │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │        School Document PWA            │  │
│  │                                       │  │
│  │ React + TypeScript + Vite             │  │
│  │                                       │  │
│  │ ┌───────────────────────────────────┐ │  │
│  │ │ rHWP Rust/WASM                   │ │  │
│  │ │ parse / render / edit / export   │ │  │
│  │ └───────────────────────────────────┘ │  │
│  └───────────────────────────────────────┘  │
│          │                       │          │
│          │                       │          │
│   Local File API            Drive API      │
└──────────┼───────────────────────┼──────────┘
           │                       │
           ▼                       ▼
  Local File / IndexedDB     Google Drive

                        │
                        ▼
                  Cloud Run API
                        │
           ┌────────────┴────────────┐
           ▼                         ▼
       Firestore               Cloud Logging
```

---

# 10. 기술 스택

## 10.1 Frontend

```text
React
TypeScript
Vite
PWA
```

주요 패키지:

```text
@rhwp/core
@rhwp/editor
Google Identity Services
Google Picker API
```

상태 관리:

우선순위:

1. React built-in state
2. Zustand

대규모 Redux 도입은 피한다.

에디터 통합 방식:

`@rhwp/editor`는 메뉴, 툴바, 서식, 표 편집을 모두 포함한 iframe 기반 완성형 편집기다. `@rhwp/core`는 파서와 렌더러 API다. 두 방식은 구현 범위가 크게 다르므로 Sprint 0에서 하나를 선택한다.

| 방식 | 장점 | 단점 |
|---|---|---|
| `@rhwp/editor` 임베드 | 구현량이 적고 편집 기능이 풍부함 | 8.2 편집 화면 UI를 직접 통제하기 어렵고, iframe과 앱 사이 메시지 연동이 필요함 |
| `@rhwp/core` + 자체 UI | UI, 접근성, 저장 흐름을 완전히 통제 | 편집 UI와 입력 처리를 직접 구현해야 함 |

권장: V1은 `@rhwp/editor` 임베드로 시작하고, 파일 열기·Drive·저장 흐름 같은 앱 셸은 iframe 바깥에서 구현한다. 8.2의 편집 화면 구성은 선택한 방식에 맞춰 조정한다.

---

# 10.2 Document Engine

```text
Rust
WebAssembly
rHWP
```

운영 정책:

- upstream 직접 사용 금지
- fork 유지
- 버전 고정
- upstream 업데이트 시 Compatibility Regression Test 필수

예:

```text
school-org/rhwp

release:
0.8.6-school.1
0.8.6-school.2
```

---

# 10.3 Backend

권장:

```text
Google Cloud Run
Node.js
TypeScript
```

백엔드의 역할:

- 인증 검증
- 사용자 설정
- feature flag
- 오류 이벤트
- 시스템 버전
- 관리자 설정

백엔드가 하지 않는 역할:

- HWP 파일 파싱
- HWPX 파일 파싱
- 일반 문서 내용 저장
- 학생 문서 검색
- 문서 본문 분석

운영 규모 고려:

백엔드의 실제 역할은 기능 플래그, 설정, 오류 이벤트 수집으로 작다. 운영 인력이 제한적이면 Phase 0~2에서는 다음 경량 구성으로 시작하고, 필요성이 확인되면 Cloud Run + Firestore로 확장한다.

- 기능 플래그와 설정: Firebase Remote Config 또는 정적 JSON 설정 파일
- 오류 이벤트: 최소 이벤트 수집 엔드포인트 1개

어떤 구성이든 FR-OFFLINE-002에 따라 백엔드 장애가 문서 편집을 막아서는 안 된다.

---

# 10.4 Database

권장:

```text
Cloud Firestore
```

사용 목적:

- 사용자 설정
- 앱 버전
- 기능 플래그
- 최소 로그
- 관리자 설정

문서 본문 저장 금지.

---

# 10.5 Hosting

우선순위:

1. Firebase Hosting + Cloud Run
2. Cloud Run 단독

권장 구성:

```text
https://docs.school-domain.kr
```

---

# 10.6 CI/CD

권장:

```text
GitHub
GitHub Actions
```

배포 환경:

```text
development
staging
production
```

---

# 11. 데이터 모델

# 11.1 User

```typescript
interface User {
  id: string; // Google sub
  role: "student" | "teacher" | "admin";
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
}
```

---

# 11.2 UserPreferences

```typescript
interface UserPreferences {
  userId: string;
  theme?: "light" | "dark" | "system";
  zoom?: number;
}
```

---

# 11.3 AppConfig

```typescript
interface AppConfig {
  version: string;
  rhwpVersion: string;
  maintenanceMode: boolean;
  allowHwpSave: boolean;
  allowPdfExport: boolean;
}
```

---

# 11.4 Event

```typescript
interface AppEvent {
  type:
    | "app_open"
    | "file_open"
    | "file_open_failed"
    | "save_success"
    | "save_failed"
    | "export_pdf"
    | "unexpected_error";

  timestamp: Timestamp;
  appVersion: string;
  browserVersion?: string;
  chromeOsVersion?: string;
  errorCode?: string;
}
```

금지 항목:

- 파일 내용
- 전체 문서 제목
- 학생이 작성한 본문
- 민감한 개인정보

---

# 12. 보안 요구사항

## SEC-001

모든 통신은 HTTPS를 사용한다.

## SEC-002

OAuth Secret은 Secret Manager를 사용한다.

## SEC-003

소스코드에 Secret을 저장하지 않는다.

## SEC-004

사용자 OAuth Scope는 최소 권한 원칙을 따른다.

## SEC-005

Domain-wide Delegation은 V1에서 사용하지 않는다.

## SEC-006

학생 문서의 전체 내용을 서버 로그에 기록하지 않는다.

## SEC-007

업로드된 문서는 가능한 한 브라우저에서 처리한다.

## SEC-008

다음 공격을 고려한다.

- ZIP bomb
- malformed XML
- malformed OLE
- excessively large image
- excessively large document
- parser crash
- memory exhaustion

## SEC-009

Cloud Run 요청 로그와 Cloud Logging은 IP 주소, User-Agent, 요청 URL을 자동 기록한다. 따라서 다음을 적용한다.

- 요청 URL과 쿼리 문자열에 파일명, 문서 제목, 이메일을 넣지 않는다.
- 로그 보존 기간을 명시적으로 설정한다(예: 30일).
- 개인정보 처리 안내에 자동 수집 항목(IP 주소 등)을 포함한다.

## SEC-010

학교 문서를 개발이나 테스트에 사용할 때는 익명화한 뒤에만 저장소와 개발 도구(Claude Code 포함)에 제공한다. 익명화되지 않은 원본 문서는 외부 AI 서비스로 전송하지 않는다.

---

# 13. 파일 제한

초기 권장값:

```text
HWP/HWPX 최대 파일 크기: 50 MB
문서 내 이미지 최대 개수: 200
단일 이미지 최대 크기: 20 MB
압축 해제 후 최대 크기: 250 MB
```

실제 Pilot 결과에 따라 변경할 수 있다.

---

# 14. 브라우저 성능 보호

다음 보호 기능을 적용한다.

- Web Worker 사용 검토
- WASM 메모리 모니터링
- 큰 문서 경고
- 파싱 timeout
- 렌더링 진행 표시
- 취소 버튼

---

# 15. 호환성 정책

# 15.1 기본 포맷

```text
HWPX
```

# 15.2 호환 포맷

```text
HWP
```

# 15.3 출력 포맷

```text
PDF
```

# 15.4 폰트 정책

학교 HWP/HWPX 문서는 대부분 함초롬바탕, 함초롬돋움 같은 한컴 계열 폰트를 사용하지만 ChromeOS에는 이 폰트가 없다. 폰트 차이는 줄바꿈, 쪽 나눔, 표 크기를 바꾸므로 호환성의 핵심 변수다.

요구사항:

- Compatibility Corpus에서 사용 빈도가 높은 폰트 목록을 추출한다.
- 재배포가 허용된 폰트는 웹폰트로 번들하고, 라이선스를 29장 라이선스 페이지에 기록한다.
- 재배포할 수 없는 폰트는 글자 폭이 비슷한 대체 폰트 매핑 표를 정의한다.
- 대체 폰트가 적용된 문서는 FR-OPEN-003과 같은 방식으로 레이아웃 차이 가능성을 안내한다.
- 폰트 번들이 초기 로딩 시간(25장)에 주는 영향을 측정한다.

---

# 16. Compatibility Test Suite

본 프로젝트의 핵심 품질 관리 체계로 운영한다.

학교에서 실제 사용하는 문서 유형을 익명화하여 테스트셋을 만든다.

권장 초기 테스트 문서 수:

```text
100~300개
```

분류:

- 일반 문서
- 과제 양식
- 표 중심 활동지
- 이미지 포함 문서
- 글상자
- 머리말
- 꼬리말
- 쪽번호
- 다단
- 수식
- 복잡한 표
- 여러 페이지 문서

---

# 17. Round Trip Test

다음 시나리오를 자동 검증한다.

```text
original.hwp
    ↓
rHWP load
    ↓
save
    ↓
saved.hwp
    ↓
rHWP reopen
```

HWPX도 동일하게 수행한다.

---

# 18. Visual Regression Test

가능한 문서에 대해 다음 비교를 수행한다.

```text
원본
 ↓
Reference PDF

rHWP
 ↓
Generated PDF

Reference PDF
 ↕
Generated PDF
```

검사 대상:

- 글자 위치
- 표
- 줄바꿈
- 페이지 나눔
- 이미지 위치
- 페이지 수

운영 조건:

- Reference PDF는 한컴오피스에서 생성해야 하므로 학교 보유 라이선스로 생성 환경을 확보한다.
- 비교 방식(픽셀 비교, 텍스트 위치 비교)과 허용 오차 기준은 Phase 1에서 정한다.
- 테스트 문서는 32장 Rule 5에 따라 익명화한다.

---

# 19. 저장 안정성 테스트

## 저장 조건

다음 조건을 모두 만족해야 실제 Drive 파일을 갱신한다.

```text
serialize 성공
AND
generated file validation 성공
AND
generated file reparse 성공
```

하나라도 실패:

```text
Drive overwrite 금지
```

---

# 20. 기능 플래그

관리자가 기능을 단계적으로 활성화할 수 있어야 한다.

예:

```typescript
{
  allowHwpOpen: true,
  allowHwpSave: false,
  allowHwpxOpen: true,
  allowHwpxSave: true,
  allowPdfExport: true,
  allowDriveIntegration: true
}
```

---

# 21. 배포 전략

# Phase 0

개발자 전용.

사용자:

```text
1~3명
```

목표:

- 기본 앱 실행
- rHWP 통합
- HWPX 열기
- HWPX 저장

---

# Phase 1

교직원 Pilot.

사용자:

```text
5~10명
```

목표:

- 실제 학교 문서 테스트
- 호환성 문제 수집
- UI 개선

---

# Phase 2

학생 Pilot OU.

사용자:

```text
30~50명
```

목표:

- ChromeOS 운영
- Drive API
- 저장 안정성
- 실제 과제 제출

---

# Phase 3

학년 단위 배포.

사용자:

```text
150~250명
```

목표:

- 동시 사용
- 장애 대응
- 운영 지표 검증

---

# Phase 4

학교 전체.

사용자:

```text
약 700명
```

---

# 22. Google Admin 배포

관리 콘솔 기준:

```text
관리 콘솔
→ 기기
→ Chrome
→ 앱 및 확장 프로그램
→ 사용자 및 브라우저
→ 대상 OU
```

배포 정책:

```text
Force install
Pin to taskbar
```

18세 미만 사용자 앱 접근 설정 (필수):

Google Workspace for Education은 18세 미만으로 지정된 사용자가 접근 설정이 없는 서드파티 앱을 쓰지 못하도록 기본 차단한다. PWA를 배포해도 이 설정이 없으면 학생 로그인과 Drive 연동이 막히므로 다음을 먼저 수행한다.

```text
관리 콘솔
→ 보안
→ 액세스 및 데이터 제어
→ API 제어
→ 앱 액세스 제어
→ 본 앱의 OAuth 클라이언트를 '신뢰함'으로 구성
```

- Pilot OU에 먼저 적용한다.
- 관련 법령상 보호자 동의가 필요한지 학교가 확인한다.
- Phase 2 이전에 학생 테스트 계정으로 로그인, Picker, Drive 저장을 검증한다.

초기에는 Pilot OU에서만 배포한다.

예:

```text
학생
├─ Pilot
├─ 1학년
├─ 2학년
└─ 3학년
```

---

# 23. 모니터링

수집 지표:

- 활성 사용자
- 앱 실행 횟수
- 파일 열기 성공률
- 파일 열기 실패율
- 저장 성공률
- 저장 실패율
- PDF 출력 성공률
- 평균 파일 크기
- 평균 문서 열기 시간
- parser 오류 코드
- ChromeOS 버전
- 앱 버전

문서 내용은 수집하지 않는다.

---

# 24. 오류 코드

예:

```text
AUTH_001
INVALID_DOMAIN

DOC_001
UNSUPPORTED_HWP

DOC_002
CORRUPTED_FILE

DOC_003
FILE_TOO_LARGE

SAVE_001
SERIALIZATION_FAILED

SAVE_002
VALIDATION_FAILED

SAVE_003
DRIVE_UPDATE_FAILED

PDF_001
PDF_EXPORT_FAILED
```

---

# 25. 성능 목표

일반적인 10MB 이하 문서 기준:

```text
앱 최초 실행: 5초 이내
문서 열기: 5초 이내
저장: 5초 이내
```

Chromebook 성능 차이를 고려하여 목표값은 Pilot에서 보정한다.

앱 최초 실행 목표는 Service Worker 캐시가 있는 상태를 기준으로 한다. 캐시가 없는 첫 설치 시간은 별도로 측정한다.

---

# 26. 가용성 목표

초기 목표:

```text
월 가용성 99.5%
```

학교 수업시간 기준 장애를 최소화한다.

---

# 27. 개인정보 및 데이터 처리 원칙

## 원칙 1

학생 문서 본문은 학교 앱 서버에 저장하지 않는다.

## 원칙 2

문서는 다음 위치에만 존재할 수 있다.

```text
사용자 Chromebook
사용자 Google Drive
```

## 원칙 3

서버에는 다음 정보만 저장한다.

- Google sub
- 최소 사용자 설정
- 익명화된 오류 이벤트
- 앱 버전
- 기능 플래그

## 원칙 4

인프라가 자동 수집하는 정보(IP 주소 등)도 개인정보로 간주하여 보존 기간을 제한하고 처리 안내에 명시한다(SEC-009).

---

# 28. 오픈소스 정책

rHWP는 학교 전용 fork를 유지한다.

구조:

```text
upstream
edwardkim/rhwp

↓ sync

school-org/rhwp

↓ test

school release
```

upstream 변경을 production에 자동 적용하지 않는다.

유지 비용 관리:

- 학교 전용 패치는 최소화하고, 범용 수정은 upstream에 기여한다.
- 학교 패치가 없는 동안에는 fork 대신 npm 정확 버전 고정과 lockfile로 운영할 수 있다.
- rHWP는 v1.0 이전 단계이므로 minor 업데이트에도 API 변경이 있을 수 있다고 가정한다.

---

# 29. 라이선스 관리

앱 내에 다음 페이지를 제공한다.

```text
설정
→ 오픈소스 라이선스
```

포함 항목:

- rHWP
- Rust dependency
- npm dependency
- 사용 폰트

학교 서비스가 한컴 공식 제품으로 오인되지 않도록 한다.

---

# 30. Repository 구조

권장:

```text
school-hwp/
│
├─ apps/
│   ├─ web/
│   └─ api/
│
├─ packages/
│   ├─ editor/
│   ├─ auth/
│   ├─ drive/
│   ├─ ui/
│   └─ shared/
│
├─ vendor/
│   └─ rhwp/
│
├─ tests/
│   ├─ unit/
│   ├─ e2e/
│   ├─ compatibility/
│   └─ fixtures/
│
├─ infra/
│   ├─ cloud-run/
│   ├─ firebase/
│   └─ github-actions/
│
├─ docs/
│   ├─ architecture.md
│   ├─ security.md
│   ├─ compatibility.md
│   └─ deployment.md
│
├─ CLAUDE.md
│
├─ README.md
│
└─ package.json
```

---

# 31. Claude Code 개발 규칙

프로젝트 루트의 `CLAUDE.md`에 최소 다음 규칙을 기록한다.

```text
1. Production document files must never be uploaded to our backend.

2. HWP/HWPX parsing must occur client-side unless explicitly approved.

3. Default save format is HWPX.

4. Never request full Google Drive scope when drive.file is sufficient.

5. Use Google sub as the primary user identity.

6. Never log document contents.

7. Every serializer change requires round-trip tests.

8. Every rHWP upstream update requires compatibility regression tests.

9. Production rHWP version must be pinned.

10. Saving over an existing Drive file requires validation before overwrite.

11. New backend endpoints require authentication and authorization review.

12. Domain-wide delegation must not be introduced without explicit architecture approval.

13. Never read, paste, or commit non-anonymized school documents. Use only anonymized fixtures under tests/fixtures.

14. PDF generation must stay client-side. Server-side conversion requires explicit architecture approval.

15. Opening, editing, and local saving must keep working when the backend is unavailable.
```

---

# 32. 개발 원칙

## Rule 1

문서 엔진과 UI를 분리한다.

## Rule 2

Google Drive 기능을 별도 package로 분리한다.

## Rule 3

rHWP fork 변경은 vendor 또는 독립 repository로 유지한다.

## Rule 4

production dependency 자동 업데이트를 제한한다.

## Rule 5

학교 문서를 테스트에 사용할 경우 반드시 익명화한다.

---

# 33. 테스트 전략

## Unit Test

대상:

- authentication
- document state
- Drive wrapper
- validation
- feature flags

---

## Integration Test

대상:

- Google Identity
- Google Picker
- Drive API
- Firestore
- Cloud Run API

---

## E2E Test

권장:

```text
Playwright
```

시나리오:

```text
login
→ new document
→ edit
→ save
→ reopen
```

---

## Compatibility Test

rHWP 업데이트 시 필수 실행.

---

# 34. 브라우저 지원

필수:

```text
최신 ChromeOS Stable
최신 Chrome Desktop
```

선택:

```text
Edge
```

V1 비지원:

```text
Safari
Firefox
```

필요성 확인 후 확대한다.

---

# 35. 접근성

최소 기준:

- 키보드 탐색
- 명확한 focus 상태
- 버튼 accessible label
- 충분한 대비
- 오류 메시지 텍스트 제공

장기적으로 WCAG 2.1 AA 수준을 목표로 한다.

---

# 36. 관리자 기능

초기 관리자 페이지에서 제공할 기능:

- 현재 앱 버전
- rHWP 버전
- 활성 사용자 수
- 저장 실패율
- 파일 열기 실패율
- maintenance mode
- feature flags

관리자 페이지에서도 사용자 문서 내용을 볼 수 없어야 한다.

---

# 37. 장애 대응

## 사용자에게 제공할 정보

```text
오류 코드
발생 시간
앱 버전
다시 시도 버튼
문제 신고 버튼
```

문제 신고 시 문서 원본 첨부는 기본으로 요구하지 않는다.

## 운영 체계

- 1차 담당자와 부재 시 대체 담당자를 지정한다.
- 수업 중 장애가 나면 쓸 대체 경로(로컬 다운로드, 다른 편집 수단 등)를 교사에게 미리 공지한다.
- maintenance mode 전환 절차와 이전 버전 롤백 절차를 `docs/deployment.md`에 문서화한다.

---

# 38. 백업

애플리케이션 데이터:

```text
Firestore export
GitHub repository
Infrastructure as Code
```

학생 문서:

```text
Google Drive가 원본 저장소
```

학교 서버에서 별도 백업하지 않는다.

---

# 39. V1 릴리스 필수 기능

다음 항목이 모두 완료되어야 V1으로 간주한다.

- [ ] Google Workspace 로그인
- [ ] 학교 도메인 제한
- [ ] PWA
- [ ] 새 HWPX 문서
- [ ] HWPX 열기
- [ ] HWP 열기
- [ ] 텍스트 편집
- [ ] 기본 서식
- [ ] 표 편집
- [ ] 로컬 HWPX 저장
- [ ] Google Drive 열기
- [ ] Google Drive 저장
- [ ] PDF 출력
- [ ] 저장 전 validation
- [ ] IndexedDB 임시 저장
- [ ] 오류 로깅
- [ ] 관리자 feature flag
- [ ] Compatibility Test Suite
- [ ] Pilot OU 배포
- [ ] 18세 미만 사용자 앱 접근 설정
- [ ] 한글 조합 입력 실기기 검증
- [ ] 폰트 번들 및 대체 폰트 매핑
- [ ] Drive 저장 충돌 감지
- [ ] 오프라인 앱 실행 (Service Worker 캐시)

---

# 40. V1 릴리스 제외 기능

- [ ] 실시간 협업
- [ ] Google Classroom API 제출
- [ ] AI 기능
- [ ] 버전 비교
- [ ] 문서 댓글
- [ ] 전자서명
- [ ] 템플릿 마켓
- [ ] 외부 학교 사용자
- [ ] 관리자 문서 검색

---

# 41. 성공 지표

Pilot 기준:

용어 정의:

- **문서 열기 성공**: 오류 없이 열리고, 모든 페이지가 렌더링되며, 본문 텍스트와 표 구조가 누락되지 않은 경우. 레이아웃 차이는 Visual Regression Test(18장)로 따로 관리한다.
- **저장 성공**: FR-SAVE-005 검증을 통과하고 대상 위치(로컬 또는 Drive)에 파일이 기록된 경우.
- **심각한 문서 손상**: 저장된 파일이 rHWP나 한컴오피스에서 열리지 않거나, 사용자가 작성한 본문 또는 표 내용이 유실된 경우.

## 문서 열기 성공률

```text
>= 95%
```

학교에서 선정한 호환성 테스트 문서 기준.

## 저장 성공률

```text
>= 99%
```

## HWPX 재열기 성공률

```text
>= 99%
```

## 사용자 과제 제출 성공률

```text
>= 95%
```

## 심각한 문서 손상

```text
0건
```

---

# 42. Production Go/No-Go 기준

전체 학생 배포 전 다음 조건을 충족해야 한다.

- [ ] Pilot 사용자 최소 30명 이상
- [ ] 실제 사용 2주 이상
- [ ] Critical 문서 손상 버그 0건
- [ ] 저장 성공률 99% 이상
- [ ] 주요 테스트 HWPX 호환률 95% 이상
- [ ] Drive 저장 안정성 확인
- [ ] 로그인 문제 없음
- [ ] ChromeOS managed PWA 배포 확인
- [ ] 운영자 장애 대응 문서 작성
- [ ] 오픈소스 라이선스 확인

---

# 43. 주요 리스크

## R1. HWP 호환성

가장 큰 기술 리스크.

대응:

- HWPX 기본 저장
- Compatibility Corpus
- Pilot
- 경고 시스템

---

## R2. upstream rHWP 변경

대응:

- fork
- version pin
- regression test

---

## R3. 문서 손상

대응:

```text
serialize
→ validation
→ reparse
→ save
```

---

## R4. Google API 변경

대응:

- Drive abstraction layer
- OAuth wrapper 분리

---

## R5. Chromebook 성능 차이

대응:

- 문서 크기 제한
- Web Worker
- WASM memory guard
- 실제 학교 기기 테스트

---

## R6. 폰트 차이로 인한 레이아웃 변경

대응:

- 폰트 정책 (15.4)
- 대체 폰트 매핑
- Visual Regression Test

---

## R7. 한글 조합 입력 결함

대응:

- Sprint 0 실기기 검증
- IME E2E 시나리오
- upstream 이슈 보고

---

## R8. 미성년자 앱 접근 정책

대응:

- 관리 콘솔 앱 액세스 제어 설정 (22장)
- Pilot OU 선적용

---

## R9. 운영 인력 부족

대응:

- 경량 백엔드로 시작 (10.3)
- 담당자와 대체 담당자 지정 (37장)
- 장애 시 대체 경로 사전 공지

---

# 44. 향후 로드맵

## V1.1

- 파일 연결
- Chromebook `Open with`
- 최근 문서 개선
- HWP compatibility 향상

## V1.5

- Google Classroom 연동
- 학교 템플릿
- 교사 배포용 문서 생성

## V2

- 공동 편집
- 문서 코멘트
- AI 보조 기능
- 관리자 통계 고도화

---

# 45. 구현 우선순위

## P0

반드시 필요.

```text
Auth
rHWP WASM
HWPX
Drive
Save validation
PWA
Korean IME
Under-18 app access
```

## P1

V1 필수. P0 완료 후 구현한다.

```text
HWP compatibility
PDF
Autosave
Admin
Monitoring
Font policy
Offline
```

P0과 P1을 합친 범위는 39장 V1 릴리스 필수 기능과 일치해야 한다.

## P2

후속 기능.

```text
Classroom
Open with
Templates
```

## P3

장기 기능.

```text
Collaboration
AI
```

---

# 46. 첫 번째 개발 Sprint

## Sprint 0

목표:

프로젝트 Skeleton.

작업:

- repository 생성
- React + Vite
- TypeScript
- PWA
- GitHub Actions
- staging 배포
- Google Login
- rHWP dependency 검토
- CLAUDE.md 작성

기술 검증(Spike) 항목:

- 18세 미만 테스트 계정으로 로그인과 Picker 접근 확인
- `@rhwp/editor` 임베드와 `@rhwp/core` 자체 UI 중 통합 방식 결정 (10.1)
- 브라우저 PDF 생성 방식 결정 (FR-PDF-003)
- Chromebook 실기기 한글 조합 입력 확인
- 학교 문서 샘플의 폰트 사용 현황 조사와 웹폰트 라이선스 확인
- WASM 번들 크기와 최초 로딩 시간 측정
- 사용자 역할 판별 방식 확정 (FR-AUTH-006)

완료 조건:

```text
Chromebook에서 PWA 실행
학교 계정 로그인
빈 편집 화면 표시
```

---

# 47. 두 번째 개발 Sprint

## Sprint 1

목표:

HWPX 기본 기능.

작업:

- HWPX 파일 열기
- 문서 렌더링
- 텍스트 편집
- HWPX 저장
- HWPX reparse validation

완료 조건:

```text
sample.hwpx
→ open
→ edit
→ save
→ reopen
```

전체 과정 성공.

---

# 48. 세 번째 개발 Sprint

## Sprint 2

목표:

Google Drive 통합.

작업:

- Picker
- Drive file download
- Drive upload
- Drive update
- Save As

완료 조건:

```text
Drive
→ file open
→ edit
→ save
→ Drive reopen
```

성공.

---

# 49. 네 번째 개발 Sprint

## Sprint 3

목표:

HWP 및 PDF.

작업:

- HWP import
- compatibility warning
- HWP save 검증
- PDF export

---

# 50. 다섯 번째 개발 Sprint

## Sprint 4

목표:

학교 Pilot.

작업:

- Admin Console PWA 배포
- Pilot OU
- Monitoring
- compatibility corpus
- feedback system
- error reporting

---

# 51. Definition of Done

기능은 다음 조건을 모두 충족해야 완료로 간주한다.

- 코드 리뷰 완료
- 테스트 존재
- E2E 성공
- 보안 영향 검토
- 문서 업데이트
- staging 검증
- Chromebook 실제 기기 테스트
- 기존 문서 기능 regression 없음

문서 serializer 관련 변경은 추가로:

```text
Round-trip Test
Compatibility Test
```

를 반드시 통과해야 한다.

---

# 52. 핵심 기술 결정 요약

| 영역 | 결정 |
|---|---|
| 기본 문서 포맷 | HWPX |
| HWP 역할 | 호환 포맷 |
| 문서 처리 | Client-side |
| 엔진 | rHWP Rust/WASM |
| Frontend | React + TypeScript + Vite |
| 배포 형태 | PWA |
| 인증 | Google Workspace |
| 저장 | Google Drive |
| 서버 | Cloud Run |
| DB | Firestore |
| 문서 서버 저장 | 금지 |
| CI/CD | GitHub Actions |
| E2E | Playwright |
| 운영 배포 | Chrome Admin OU |
| rHWP 관리 | Fork + Version Pin |
| 개발 AI | Claude Code Max |
| 학생 문서 AI 전송 | 금지 |
| PDF 생성 | 브라우저 (서버 변환 금지) |
| 에디터 통합 | Sprint 0에서 결정 (`@rhwp/editor` 임베드 권장) |
| 폰트 | 웹폰트 번들 + 대체 폰트 매핑 |
| 미성년자 접근 | 관리 콘솔에서 앱을 '신뢰함'으로 구성 |

---

# 53. 최종 제품 원칙

본 시스템은 한컴오피스를 완전히 재구현하는 것을 목적으로 하지 않는다.

목표는 학교 Chromebook 환경에서 학생과 교직원이 가장 자주 수행하는 다음 작업을 안정적으로 제공하는 것이다.

```text
열기
작성
수정
저장
제출
```

성공 기준은 기능의 개수가 아니라 다음에 있다.

1. 학생이 쉽게 사용할 수 있는가.
2. 저장한 문서가 손상되지 않는가.
3. 학교 문서의 대부분을 정상적으로 처리하는가.
4. Google Workspace와 자연스럽게 통합되는가.
5. 관리자가 안전하게 배포하고 통제할 수 있는가.
6. 학교가 특정 상용 OS 또는 로컬 프로그램에 종속되지 않는가.

따라서 모든 기술 의사결정은 다음 우선순위를 따른다.

```text
문서 안정성
>
데이터 보호
>
사용성
>
관리 편의성
>
기능 수
```

---

# 54. 프로젝트 코드명

권장 코드명:

```text
SchoolDocs
```

또는

```text
HanDoc
```

실제 서비스 명칭은 한컴 공식 제품으로 오인되지 않는 독립적인 이름을 사용한다.

---

# 55. 다음 산출물

이 PRD 승인 후 다음 문서를 순차적으로 작성한다.

```text
docs/architecture.md
docs/security.md
docs/compatibility.md
docs/deployment.md
docs/google-workspace-integration.md
docs/rhwp-integration.md
docs/fonts.md
docs/operations.md
CLAUDE.md
README.md
```

이후 Claude Code를 사용하여 `Sprint 0`부터 구현을 시작한다.

---

# 부록 A. 변경 이력

| 버전 | 날짜 | 변경 내용 |
|---|---|---|
| v1.0 | 2026-09-28 | 최초 작성 |
| v1.1 | 2026-09-28 | 검토 반영: 18세 미만 앱 접근 설정(22장), 폰트 정책(15.4), 에디터 통합 방식 결정(10.1), 브라우저 PDF 생성 방식(FR-PDF-003), 한글 입력(7.9), 오프라인·백엔드 장애 동작(7.8), 역할 판별(FR-AUTH-006), Drive 저장 충돌 감지(FR-SAVE-007~008), 로그 개인정보(SEC-009~010), 성공 지표 정의(41장), 리스크 R6~R9, 우선순위와 V1 필수 목록 정합화, 자동 저장을 V1 필수로 통일 |
