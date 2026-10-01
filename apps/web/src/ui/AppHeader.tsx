import { useState } from 'react';
import { signOut } from '../actions';
import { BRAND } from '../branding';
import { BASE } from '../env';
import { useApp } from '../store';
import { AccountChip } from './AccountChip';

/** 메인·관리자·라이선스 화면 공통 머리글 */
export function AppHeader({ title = BRAND.appName }: { title?: string }) {
  const user = useApp((s) => s.user);
  const go = useApp((s) => s.go);
  const updateReady = useApp((s) => s.updateReady);
  const [confirming, setConfirming] = useState(false);

  return (
    <header className="app-header">
      <button type="button" className="app-title" onClick={() => go('home')}>
        <img src={`${BASE}icons/icon-192.png`} alt="" width={28} height={28} />
        <span>{title}</span>
      </button>
      <nav className="header-nav" aria-label="설정">
        {updateReady && <span className="badge">새 버전 준비됨: 앱을 다시 열면 적용됩니다</span>}
        {user?.role === 'admin' && (
          <button type="button" className="btn btn-ghost" onClick={() => go('admin')}>
            관리자
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => go('licenses')}>
          앱 정보·라이선스
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => go('privacy')}>
          개인정보 처리 안내
        </button>
        <AccountChip onLogout={() => setConfirming(true)} />
        <button type="button" className="btn btn-dark" onClick={() => setConfirming(true)}>
          로그아웃
        </button>
      </nav>
      {confirming && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="logout-title">
          <div className="dialog">
            <h2 id="logout-title">로그아웃</h2>
            <p>이 기기에 자동 저장된 임시 문서도 지울까요? 공용 크롬북이라면 지우는 것을 권장합니다.</p>
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                취소
              </button>
              <button type="button" className="btn" onClick={() => void signOut({ deleteDrafts: false })}>
                임시 문서 남기기
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void signOut({ deleteDrafts: true })}>
                임시 문서 지우고 로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
