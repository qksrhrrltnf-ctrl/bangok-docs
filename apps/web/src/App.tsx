import { useEffect } from 'react';
import { useAuth } from './auth/useAuth';
import { BRAND } from './branding';
import { env } from './env';
import { loadConfig } from './config/flags';
import { useApp } from './store';
import { AdminScreen } from './ui/AdminScreen';
import { EditorScreen } from './ui/EditorScreen';
import { ErrorPanel } from './ui/ErrorPanel';
import { HomeScreen } from './ui/HomeScreen';
import { LicensesScreen } from './ui/LicensesScreen';
import { LoginScreen } from './ui/LoginScreen';
import { PrivacyScreen } from './ui/PrivacyScreen';
import { Notices } from './ui/Notices';
import { BusyOverlay, Splash } from './ui/Status';

export function App() {
  const config = useApp((s) => s.config);
  const user = useApp((s) => s.user);
  const screen = useApp((s) => s.screen);
  const doc = useApp((s) => s.doc);
  const { status, error, reviewSignIn } = useAuth();

  useEffect(() => {
    let alive = true;
    void loadConfig().then((c) => alive && useApp.getState().setConfig(c));
    return () => {
      alive = false;
    };
  }, []);

  if (!config || status === 'checking') return <Splash />;

  if (status === 'misconfigured') {
    return (
      <main className="center-page">
        <h1>설정이 필요합니다</h1>
        <p>Google 로그인 설정(VITE_GOOGLE_CLIENT_ID, VITE_ALLOWED_DOMAIN)이 없습니다.</p>
        <p>관리자는 docs/google-workspace-integration.md 를 참고해 설정해 주세요.</p>
        <p className="muted">{BRAND.supportContact}</p>
      </main>
    );
  }

  if (!user) return <LoginScreen error={error} onReviewSignIn={reviewSignIn} />;

  if (config.flags.maintenanceMode && user.role !== 'admin') {
    return (
      <main className="center-page">
        <h1>점검 중</h1>
        <p>{config.maintenanceMessage}</p>
      </main>
    );
  }

  return (
    <>
      {screen === 'editor' && doc ? (
        <EditorScreen key={doc.draftId} />
      ) : screen === 'admin' && user.role === 'admin' ? (
        <AdminScreen />
      ) : screen === 'licenses' ? (
        <LicensesScreen />
      ) : screen === 'privacy' ? (
        <PrivacyScreen />
      ) : (
        <HomeScreen />
      )}
      {env.devAuthBypass && (
        <div className="review-badge" title="Google 로그인과 Drive 연동이 꺼진 검토용 빌드입니다. 학생에게 배포하지 마세요.">
          검토용 빌드 · 로그인·Drive 꺼짐
        </div>
      )}
      <ErrorPanel />
      <BusyOverlay />
      <Notices />
    </>
  );
}
