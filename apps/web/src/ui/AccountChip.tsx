import { useEffect, useRef, useState } from 'react';
import type { Role } from '../auth/role';
import { BRAND } from '../branding';
import { useApp, type User } from '../store';

const ROLE_LABEL: Record<Role, string> = { student: '학생', teacher: '교직원', admin: '관리자' };

export function roleLabel(user: User): string {
  return user.dev ? '검토용' : ROLE_LABEL[user.role];
}

function Avatar({ user, size }: { user: User; size: number }) {
  return user.picture ? (
    <img className="avatar-img" src={user.picture} alt="" width={size} height={size} referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {user.name.slice(0, 1)}
    </span>
  );
}

/**
 * 로그인한 계정 표시 (이름 + 학교 이메일 + 역할).
 * 공용 크롬북에서 다른 사람 계정으로 작업하는 실수를 막기 위해 모든 화면에 항상 보인다.
 * 누르면 계정 상세와 로그아웃이 나온다.
 */
export function AccountChip({ onLogout, compact = false }: { onLogout?: () => void; compact?: boolean }) {
  const user = useApp((s) => s.user);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  if (!user) return null;
  const wrongDomain = !user.dev && user.hd !== BRAND.domain;

  return (
    <div className={`account ${compact ? 'account-compact' : ''}`} ref={ref}>
      <button
        type="button"
        className={`account-chip ${wrongDomain ? 'account-warn' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`로그인한 계정: ${user.name}, ${user.email}, ${roleLabel(user)}`}
        title={`${user.name} · ${user.email}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Avatar user={user} size={28} />
        <span className="account-text">
          <span className="account-name">
            {user.name}
            <span className="account-role">{roleLabel(user)}</span>
          </span>
          <span className="account-email">{user.email}</span>
        </span>
      </button>

      {open && (
        <div className="account-menu" role="dialog" aria-label="계정 정보">
          <div className="account-menu-head">
            <Avatar user={user} size={48} />
            <div>
              <strong>{user.name}</strong>
              <div className="account-email-full">{user.email}</div>
            </div>
          </div>
          <dl className="kv">
            <dt>구분</dt>
            <dd>{roleLabel(user)}</dd>
            <dt>학교</dt>
            <dd>{user.dev ? '검토용 빌드 (Google 로그인 꺼짐)' : `${BRAND.schoolName} (@${user.hd})`}</dd>
          </dl>
          <p className="muted account-tip">
            {user.dev
              ? '검토용 계정입니다. 학생 배포 전에 Google 로그인으로 바뀝니다.'
              : '내 계정이 아니면 지금 로그아웃하세요. 문서는 이 계정의 Google Drive와 이 크롬북에 저장됩니다.'}
          </p>
          {onLogout ? (
            <button
              type="button"
              className="btn btn-dark"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
            >
              로그아웃 · 다른 계정으로 로그인
            </button>
          ) : (
            <p className="muted account-tip">로그아웃은 문서를 닫은 뒤 처음 화면에서 할 수 있어요.</p>
          )}
        </div>
      )}
    </div>
  );
}
