import { useEffect, useRef, useState } from 'react';
import { BRAND } from '../branding';
import { env } from '../env';
import { useApp } from '../store';
import { track } from '../telemetry/events';

/**
 * 오류 안내 (PRD 37장): 오류 코드, 발생 시간, 앱 버전, 다시 시도, 문제 신고.
 * 문제 신고에는 문서 원본이나 파일 이름을 넣지 않는다.
 */
export function ErrorPanel() {
  const error = useApp((s) => s.error);
  const retry = useApp((s) => s.retry);
  const showError = useApp((s) => s.showError);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!error) return;
    setCopied(false);
    closeRef.current?.focus();
    if (error.code === 'APP_001') track('unexpected_error', { errorCode: error.code });
  }, [error]);

  if (!error) return null;

  const time = error.occurredAt.toLocaleString('ko-KR');
  const report = [
    `오류 코드: ${error.code}`,
    `발생 시간: ${time}`,
    `앱: ${BRAND.appName} ${env.appVersion} (rHWP ${env.rhwpVersion})`,
    `브라우저: ${navigator.userAgent}`,
  ].join('\n');

  const close = () => showError(null);

  return (
    <div className="overlay" role="alertdialog" aria-modal="true" aria-labelledby="error-title" aria-describedby="error-desc">
      <div className="dialog">
        <h2 id="error-title">{error.userMessage}</h2>
        <p id="error-desc" className="muted">
          {error.code === 'SAVE_002' || error.code === 'SAVE_001'
            ? '파일을 저장하지 않았습니다. 원래 파일은 그대로 있습니다. 편집 중인 내용은 화면에 남아 있습니다.'
            : `다시 시도해도 계속되면 문제 신고 내용을 복사해 ${BRAND.supportContact}에 전달해 주세요.`}
        </p>
        <dl className="error-meta">
          <dt>오류 코드</dt>
          <dd>{error.code}</dd>
          <dt>발생 시간</dt>
          <dd>{time}</dd>
          <dt>앱 버전</dt>
          <dd>{env.appVersion}</dd>
        </dl>
        <div className="dialog-actions">
          <button
            type="button"
            className="btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(report);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? '신고 내용 복사됨' : '문제 신고 (내용 복사)'}
          </button>
          {retry && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                close();
                retry();
              }}
            >
              다시 시도
            </button>
          )}
          <button ref={closeRef} type="button" className="btn btn-primary" onClick={close}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
