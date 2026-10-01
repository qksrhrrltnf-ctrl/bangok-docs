import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { newDocument, openDroppedFile, openFromDevice, openFromDrive, openRecent, restoreDraft } from '../actions';
import { deleteDraft, listDrafts, type DraftSummary } from '../autosave/draftStore';
import { BRAND } from '../branding';
import { driveConfigured } from '../env';
import { listRecent, type RecentDoc } from '../recent/recentDocs';
import { useApp } from '../store';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';
import { Doodles, Mascot } from './Mascot';
import { useReveal } from './useReveal';

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STEPS = [
  { title: '열기', text: '새 문서를 만들거나 크롬북·Drive의 HWP·HWPX 파일을 열어요.' },
  { title: '고치기', text: '글꼴, 문단, 표를 한컴오피스처럼 편집해요. 60초마다 임시 저장돼요.' },
  { title: '저장·제출', text: 'Ctrl+S로 저장하고, 제출 전에는 PDF로도 확인해요.' },
];

export function HomeScreen() {
  const user = useApp((s) => s.user)!;
  const go = useApp((s) => s.go);
  const flags = useApp((s) => s.config!.flags);
  const [recent, setRecent] = useState<RecentDoc[]>([]);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [dragging, setDragging] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const driveEnabled = driveConfigured && flags.allowDriveIntegration;

  const refresh = useCallback(() => {
    setRecent(listRecent(user.sub));
    listDrafts(user.sub).then(setDrafts, () => setDrafts([]));
  }, [user.sub]);

  useEffect(refresh, [refresh]);
  useReveal(mainRef, [drafts.length, recent.length]);

  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const item = e.dataTransfer.items?.[0];
    let handle: FileSystemFileHandle | null = null;
    const withHandle = item as DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> };
    const handlePromise = withHandle?.getAsFileSystemHandle?.();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    try {
      const h = await handlePromise;
      if (h && h.kind === 'file') handle = h as FileSystemFileHandle;
    } catch {
      handle = null;
    }
    await openDroppedFile(file, handle);
  };

  return (
    <div
      className="home"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.relatedTarget || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <AppHeader />
      <main className="home-main" ref={mainRef}>
        <section className="hero reveal" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="hero-badges">
              <span className="pill">{BRAND.schoolName}</span>
              <span className="pill pill-yellow">크롬북 전용</span>
              <span className="pill pill-paper">HWPX · HWP</span>
            </div>
            <h1 id="hero-title" className="hero-title">
              크롬북에서 <span className="hl">HWP 문서</span>
              <br />
              바로 열고 바로 쓰기
            </h1>
            <p className="hero-lead">
              {user.name}님, 반가워요! 프로그램 설치 없이 열고, 고치고, 저장해요. 문서는 이 크롬북 안에서만 처리되고 학교 서버로 가지
              않아요.
            </p>
          </div>
          <div className="hero-art">
            <Mascot />
          </div>
          <Doodles />
        </section>

        <h2 className="section-title reveal">
          <span className="pill pill-orange">시작</span> 무엇을 할까요?
        </h2>
        <section className="actions" aria-label="문서 시작">
          <button type="button" className="action-card reveal" onClick={() => void newDocument()}>
            <span className="action-icon" aria-hidden="true">＋</span>
            <span className="action-title">새 문서</span>
            <span className="action-desc">빈 A4 문서 (HWPX)</span>
            <span className="action-go" aria-hidden="true">
              만들기 →
            </span>
          </button>
          <button type="button" className="action-card reveal" onClick={() => void openFromDevice()}>
            <span className="action-icon" aria-hidden="true">📂</span>
            <span className="action-title">파일 열기</span>
            <span className="action-desc">이 크롬북의 HWP·HWPX 파일</span>
            <span className="action-go" aria-hidden="true">
              고르기 →
            </span>
          </button>
          <button
            type="button"
            className="action-card reveal"
            onClick={() => void openFromDrive()}
            disabled={!driveEnabled}
            title={driveEnabled ? undefined : 'Google Drive 연동이 설정되지 않았습니다'}
          >
            <span className="action-icon" aria-hidden="true">☁</span>
            <span className="action-title">Drive에서 열기</span>
            <span className="action-desc">{driveEnabled ? '내 Google Drive의 문서' : '사용할 수 없음'}</span>
            <span className="action-go" aria-hidden="true">
              {driveEnabled ? 'Drive →' : '준비 중'}
            </span>
          </button>
        </section>
        <p className="drop-hint muted reveal">💡 파일을 이 화면 아무 곳에나 끌어다 놓아도 열려요.</p>

        {drafts.length > 0 && (
          <section className="list-section" aria-labelledby="drafts-title">
            <h2 id="drafts-title" className="section-title reveal">
              <span className="pill">복구</span> 복구할 수 있는 문서
            </h2>
            <p className="key reveal">저장하지 않고 닫힌 문서예요. 7일이 지나면 자동으로 지워져요.</p>
            <ul className="doc-list">
              {drafts.map((d) => (
                <li key={d.id} className="reveal">
                  <button type="button" className="doc-item" onClick={() => void restoreDraft(d.id)}>
                    <span className="doc-name">{d.fileName}</span>
                    <span className="muted">{formatTime(d.savedAt)} 자동 저장</span>
                  </button>
                  <button
                    type="button"
                    className="btn"
                    aria-label={`${d.fileName} 임시 문서 삭제`}
                    onClick={async () => {
                      await deleteDraft(d.id);
                      refresh();
                    }}
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="list-section" aria-labelledby="recent-title">
          <h2 id="recent-title" className="section-title reveal">
            <span className="pill pill-green">최근</span> 최근 문서
          </h2>
          {recent.length === 0 ? (
            <p className="empty reveal">Google Drive에서 연 문서가 여기에 차곡차곡 쌓여요.</p>
          ) : (
            <ul className="doc-list">
              {recent.map((r) => (
                <li key={r.driveFileId} className="reveal">
                  <button type="button" className="doc-item" onClick={() => void openRecent(r.driveFileId)} disabled={!driveEnabled}>
                    <span className="doc-name">{r.name}</span>
                    <span className="muted">{formatTime(r.openedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="list-section" aria-labelledby="steps-title">
          <h2 id="steps-title" className="section-title reveal">
            <span className="pill pill-yellow">안내</span> 이렇게 써요
          </h2>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="step reveal">
                <span className={`num c${i + 1}`} aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <AppFooter onAbout={() => go('licenses')} onPrivacy={() => go('privacy')} />

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-card">여기에 놓으면 열려요! 📄</div>
        </div>
      )}
    </div>
  );
}
