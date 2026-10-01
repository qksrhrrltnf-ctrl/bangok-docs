import { COPYRIGHT, DEVELOPER_CREDIT, HWP_SPEC_NOTICE } from '../branding';

/** 공통 바닥글: 저작권·개발자 표기와 한컴 공개 문서 고지 (docs/legal-review.md) */
export function AppFooter({ onAbout, onPrivacy }: { onAbout?: () => void; onPrivacy?: () => void }) {
  return (
    <footer className="app-footer">
      <p>
        {COPYRIGHT} · {DEVELOPER_CREDIT}
      </p>
      <p>{HWP_SPEC_NOTICE}</p>
      {(onAbout || onPrivacy) && (
        <p>
          {onAbout && (
            <button type="button" className="btn-link" onClick={onAbout}>
              앱 정보·오픈소스 라이선스
            </button>
          )}
          {onAbout && onPrivacy && ' · '}
          {onPrivacy && (
            <button type="button" className="btn-link" onClick={onPrivacy}>
              개인정보 처리 안내
            </button>
          )}
        </p>
      )}
    </footer>
  );
}
