import { useEffect, useRef } from 'react';
import { promptGoogleSignIn, renderGoogleButton } from '../auth/googleSignIn';
import { BRAND } from '../branding';
import { env } from '../env';
import type { AppError } from '../errors';
import { AppFooter } from './AppFooter';
import { Mascot } from './Mascot';
import { PrivacyNotice } from './PrivacyNotice';

export function LoginScreen({ error }: { error: AppError | null }) {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (buttonRef.current) renderGoogleButton(buttonRef.current);
  }, []);

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
          <p className="muted">
            {BRAND.schoolName} Google 계정({env.allowedDomain})으로 로그인하세요.
          </p>
          <div ref={buttonRef} className="google-button" />
          <p>
            <button type="button" className="btn-link" onClick={() => promptGoogleSignIn()}>
              자동 로그인 다시 시도
            </button>
          </p>
        </div>
        {error && (
          <p className="warn" role="alert">
            {error.userMessage} ({error.code})
            {error.code === 'AUTH_001' && (
              <>
                <br />
                개인 Gmail 계정이 아니라 {BRAND.schoolName} 계정으로 로그인해야 합니다.
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
