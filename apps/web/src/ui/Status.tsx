import { BRAND } from '../branding';
import { useApp } from '../store';

export function Splash() {
  return (
    <main className="center-page" aria-busy="true">
      <div className="spinner" aria-hidden="true" />
      <p>{BRAND.appName}를 준비하는 중…</p>
    </main>
  );
}

export function BusyOverlay() {
  const busy = useApp((s) => s.busy);
  if (!busy) return null;
  return (
    <div className="overlay" role="status" aria-live="polite">
      <div className="overlay-box">
        <div className="spinner" aria-hidden="true" />
        <p>{busy}</p>
      </div>
    </div>
  );
}
