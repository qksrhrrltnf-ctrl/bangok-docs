import { useEffect, useRef, useState } from 'react';
import { promptGoogleSignIn, renderGoogleButton, whenGoogleReady } from '../auth/googleSignIn';
import { BRAND } from '../branding';
import { env } from '../env';
import type { AppError } from '../errors';
import { AppFooter } from './AppFooter';
import { Mascot } from './Mascot';
import { PrivacyNotice } from './PrivacyNotice';

interface Props {
  error: AppError | null;
  /** 검토용 빌드(Google 설정 없음)에서만 주어진다 */
  onReviewSignIn?: (() => void) | null;
}

export function LoginScreen({ error, onReviewSignIn }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState<string | null>(null);
  const review = Boolean(onReviewSignIn);

  useEffect(() => {
    if (review) return;
    let alive = true;
    // 초기화가 끝난 뒤에 공식 Google 로그인 버튼을 그린다 (로그아웃 직후에도 항상 보이게)
    void whenGoogleReady().then(() => {
      if (alive && buttonRef.current) renderGoogleButton(buttonRef.current);
    });
    return () => {
      alive = false;
    };
  }, [review]);

  const retry = () => {
    setHint(null);
    promptGoogleSignIn(() =>
      setHint("계정 선택 창이 뜨지 않았어요. 위의 'Google 계정으로 로그인' 버튼을 눌러 반곡고 계정을 고르세요."),
    );
  };

  return (
    <div className="login-page">
      <main className="center-page login">
        <Mascot />
        <div className="login-card">
          <div className="hero-badges" style={{ justifyContent: 'center' }}>
            <span className="pill">{BRAND.schoolName}</span>
            <span className="pill pill-yellow">크롬북 전용</span>
          </div>
          <h1>{BRAND.appName}</h1>

          {review ? (
            <>
              <p className="muted">검토용 빌드입니다. Google 로그인 없이 검토용 계정으로 들어갑니다.</p>
              <p>
                <button type="button" className="btn btn-primary btn-lg" onClick={() => onReviewSignIn?.()}>
                  검토용 계정으로 들어가기
                </button>
              </p>
            </>
          ) : (
            <>
              <p className="muted">
                {BRAND.schoolName} Google 계정(<strong>@{env.allowedDomain}</strong>)으로 로그인하세요.
              </p>
              <div ref={buttonRef} className="google-button" aria-label="Google 계정으로 로그인" />
              <p>
                <button type="button" className="btn-link" onClick={retry}>
                  자동 로그인 다시 시도
                </button>
              </p>
              {hint && (
                <p className="key" role="status">
                  {hint}
                </p>
              )}
            </>
          )}
        </div>
        {error && (
          <p className="warn" role="alert">
            {error.userMessage} ({error.code})
            {error.code === 'AUTH_001' && (
              <>
                <br />
                개인 Gmail 계정이 아니라 {BRAND.schoolName} 계정(@{env.allowedDomain})으로 로그인해야 합니다.
              </>
            )}
          </p>
        )}
        <details className="login-privacy">
          <summary>개인정보 처리 안내</summary>
          <PrivacyNotice />
        </details>
      </main>
      <AppFooter />
    </div>
  );
}
