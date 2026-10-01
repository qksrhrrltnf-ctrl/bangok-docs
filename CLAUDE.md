# CLAUDE.md — school-hwp (반곡고 문서 편집기)

반곡고등학교 크롬북 HWP/HWPX 편집기. 개발: 반곡고등학교 2026년 정보부장. 제품 요구사항은 `docs/prd.md` (PRD v1.1).

## Non-negotiable rules (PRD 31장)

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
16. Keep license, trademark, and the Hancom HWP spec notice intact (src/branding.ts, NOTICE, docs/legal-review.md). Never remove rHWP attribution.
17. A dependency whose only license option is copyleft (GPL/AGPL/LGPL) must not be bundled. scripts/collect-licenses.mjs enforces this.

## Layout

```
apps/web/            React + TS + Vite PWA (반곡고 문서 편집기). 학교명·개발자 표기는 src/branding.json
  src/engine/        rHWP WASM 워커 (재파싱 검증, 빈 문서 템플릿)
  src/editor/        rhwp-studio(자체 호스팅, embed 프로필) 래퍼
  src/validation/    파일 정적 검사(ZIP bomb 등), 저장 전 검증, 호환성 경고
  src/documents/     열기·새 문서·저장 흐름 (UI 와 분리)
  src/drive/         Google Drive REST + Picker (Rule 2: Drive 분리)
  src/auth/          Google Identity Services, ID 토큰 클레임, 역할
  public/studio/     scripts/build-studio.mjs 가 생성 (커밋하지 않음)
apps/api/            Cloud Run API (Hono). 플래그·이벤트·관리자 지표만. 문서를 받는 엔드포인트 없음
scripts/             build-studio.mjs (rhwp-studio 고정 버전 빌드), make-icons.mjs
tests/compatibility/ round-trip 호환성 테스트 (Node + @rhwp/core)
tests/fixtures/      synthetic/ 합성 문서, private/ 익명화 학교 문서 (gitignore)
tests/e2e/           Playwright (개발 서버, 운영 빌드+CSP+오프라인)
docs/                아키텍처·보안·호환성·배포·운영 문서
```

## Commands

```bash
npm install
npm run build:studio        # rhwp-studio v<pinned> 빌드 → apps/web/public/studio (Rust 불필요)
npm run fixtures:generate   # 합성 테스트 문서
npm run dev                 # http://127.0.0.1:5173 (Google 설정 없으면 개발용 계정)
npm run typecheck && npm test
npm run test:compat         # rHWP 업데이트·serializer 변경 시 필수
npm run test:e2e            # 개발 서버 E2E
npm run test:e2e:prod       # 운영 빌드 + firebase.json CSP + 오프라인
npm run verify              # 위 전부
```

## Working notes

- rHWP 버전은 `apps/web/package.json` 의 `@rhwp/core` 와 `@rhwp/editor` 를 **같은 정확한 버전**으로 고정한다. 올릴 때는 `npm run build:studio` → `npm run test:compat` → E2E 순서로 확인하고 `docs/rhwp-integration.md` 에 기록한다.
- 보안 헤더(CSP)의 단일 출처는 `firebase.json`. 미리보기 서버가 같은 값을 읽는다. 새 외부 도메인이 필요하면 거기에 추가하고 `docs/security.md` 에 이유를 적는다.
- 저장 경로는 반드시 `documents/documentService.ts` 의 `saveDocument` 를 거친다 (직렬화 → 정적 검사 → 재파싱 → 쓰기).
- 이 저장소는 로컬 디스크에서 작업한다. Google Drive 가상 드라이브에서는 npm 설치가 멈춘다.
- 사용자 화면 문구와 문서는 한국어로 쓴다.
- 새 런타임 의존성을 추가하면 `npm run licenses` 로 고지를 다시 만들고 `docs/legal-review.md` 를 확인한다.
