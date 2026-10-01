import { useApp } from '../store';

export function Notices() {
  const notices = useApp((s) => s.notices);
  const dismiss = useApp((s) => s.dismiss);
  if (notices.length === 0) return null;
  return (
    <div className="notices" role="status" aria-live="polite">
      {notices.map((n) => (
        <div key={n.id} className={`notice notice-${n.kind}`}>
          <span>{n.text}</span>
          <button type="button" className="icon-btn" aria-label="알림 닫기" onClick={() => dismiss(n.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
