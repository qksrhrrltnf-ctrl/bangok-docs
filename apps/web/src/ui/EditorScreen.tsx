import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteDraft, putDraft } from '../autosave/draftStore';
import { canOverwrite, saveDocument, type Destination, type SaveRequest } from '../documents/documentService';
import { getDriveClient } from '../drive/driveService';
import { EditorSession } from '../editor/editorSession';
import { driveConfigured } from '../env';
import { AppError, toAppError } from '../errors';
import { printAsPdf } from '../pdf/printPdf';
import { addRecent } from '../recent/recentDocs';
import { useApp } from '../store';
import { sizeBucket, track } from '../telemetry/events';
import { SaveDialog, type SaveChoice } from './SaveDialog';

const AUTOSAVE_INTERVAL_MS = 60_000;
const DIRTY_POLL_MS = 2_000;

type SaveState = 'saved' | 'dirty' | 'saving';

export function EditorScreen() {
  const doc = useApp((s) => s.doc)!;
  const user = useApp((s) => s.user)!;
  const flags = useApp((s) => s.config!.flags);
  const { updateDoc, closeDoc, showError, notify, setBusy } = useApp.getState();

  const containerRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<EditorSession | null>(null);
  const savingRef = useRef(false);
  const docRef = useRef(doc);
  docRef.current = doc;

  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [pageCount, setPageCount] = useState(doc.pageCount);
  const [lastAutosave, setLastAutosave] = useState<number | null>(null);
  const [showWarnings, setShowWarnings] = useState(doc.compat.warnings.length > 0);
  const [saveDialog, setSaveDialog] = useState(false);
  const [conflict, setConflict] = useState<SaveChoice | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  const driveEnabled = driveConfigured && flags.allowDriveIntegration;
  const destinationOf = (d = docRef.current): Destination => (d.source.kind === 'drive' ? 'drive' : 'local');

  // ── 저장 ────────────────────────────────────────────────
  const performSave = useCallback(
    async (choice: SaveChoice & { mode: SaveRequest['mode'] }, force = false) => {
      const session = sessionRef.current;
      if (!session || savingRef.current) return;
      savingRef.current = true;
      setSaveState('saving');
      setBusy(choice.destination === 'drive' ? 'Google Drive에 저장하는 중…' : '저장하는 중…');
      const current = docRef.current;
      try {
        const result = await saveDocument({
          editor: session,
          doc: current,
          format: choice.format,
          destination: choice.destination,
          mode: choice.mode,
          fileName: choice.fileName,
          driveFolderId: choice.driveFolderId,
          force,
          flags,
          drive: getDriveClient(flags.allowDriveIntegration),
        });
        if (!result) {
          setSaveState((await session.isDirty()) ? 'dirty' : 'saved');
          return;
        }
        updateDoc({ fileName: result.fileName, sourceFormat: result.sourceFormat, source: result.source });
        setSaveState('saved');
        void deleteDraft(current.draftId).catch(() => undefined);
        if (result.source.kind === 'drive') {
          addRecent(user.sub, { driveFileId: result.source.snapshot.fileId, name: result.fileName });
        }
        notify('success', result.destination === 'drive' ? `Google Drive에 저장했습니다: ${result.fileName}` : `저장했습니다: ${result.fileName}`);
        result.warnings.forEach((w) => notify('warning', w));
        track('save_success', { format: result.sourceFormat, destination: result.destination, sizeBucket: sizeBucket(result.byteLength) });
      } catch (err) {
        const error = toAppError(err, 'SAVE_003');
        setSaveState('dirty');
        track('save_failed', { errorCode: error.code, format: choice.format, destination: choice.destination });
        if (error.code === 'SAVE_004') {
          setConflict(choice);
        } else {
          showError(error, () => void performSave(choice, force));
        }
      } finally {
        savingRef.current = false;
        setBusy(null);
      }
    },
    [flags, notify, setBusy, showError, updateDoc, user.sub],
  );

  const save = useCallback(() => {
    const current = docRef.current;
    const destination = destinationOf(current);
    // 바로 덮어쓰기는 HWPX 원본만. HWP 원본은 항상 대화상자에서 HWPX 를 기본으로 제시한다 (UC-03).
    if (current.sourceFormat === 'hwpx' && flags.allowHwpxSave && canOverwrite(current, 'hwpx', destination)) {
      void performSave({ mode: 'save', fileName: current.fileName, format: current.sourceFormat, destination });
    } else {
      setSaveDialog(true);
    }
  }, [flags.allowHwpxSave, performSave]);

  const saveAs = useCallback(() => setSaveDialog(true), []);

  const exportPdf = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    if (!flags.allowPdfExport) {
      showError(new AppError('SAVE_007', 'PDF 내보내기'));
      return;
    }
    setBusy('PDF로 만들 페이지를 준비하는 중…');
    try {
      await printAsPdf(session, docRef.current.fileName, {
        onProgress: (done, total) => setBusy(`PDF 준비 중… (${done}/${total}쪽)`),
        fontDocument: containerRef.current?.querySelector('iframe')?.contentDocument ?? null,
      });
      track('export_pdf', { format: 'pdf' });
    } catch (err) {
      const error = toAppError(err, 'PDF_001');
      track('save_failed', { errorCode: error.code, format: 'pdf' });
      showError(error, () => void exportPdf());
    } finally {
      setBusy(null);
    }
  }, [flags.allowPdfExport, setBusy, showError]);

  // 단축키 핸들러가 항상 최신 함수를 부르도록 ref 로 감싼다.
  const actions = useRef({ save, saveAs, exportPdf });
  actions.current = { save, saveAs, exportPdf };

  // ── 편집기 탑재 ──────────────────────────────────────────
  useEffect(() => {
    let disposed = false;
    const container = containerRef.current;
    if (!container) return;
    (async () => {
      try {
        const session = await EditorSession.mount(container, {
          save: () => actions.current.save(),
          saveAs: () => actions.current.saveAs(),
          print: () => void actions.current.exportPdf(),
        });
        if (disposed) {
          session.destroy();
          return;
        }
        sessionRef.current = session;
        const pages = await session.load(docRef.current.bytes, docRef.current.fileName);
        if (disposed) return;
        setPageCount(pages);
        setReady(true);
        session.focus();
      } catch (err) {
        if (disposed) return;
        showError(toAppError(err, 'EDITOR_001'));
        closeDoc();
      }
    })();
    return () => {
      disposed = true;
      sessionRef.current?.destroy();
      sessionRef.current = null;
    };
    // 문서가 바뀌면 key 로 컴포넌트를 새로 만든다 (App.tsx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 변경 감지 ────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(async () => {
      const session = sessionRef.current;
      if (!session || savingRef.current) return;
      const dirty = await session.isDirty();
      setSaveState((prev) => (prev === 'saving' ? prev : dirty ? 'dirty' : 'saved'));
      session.pageCount().then(setPageCount, () => undefined);
    }, DIRTY_POLL_MS);
    return () => clearInterval(timer);
  }, [ready]);

  // ── 자동 저장: 로컬 IndexedDB 만 (FR-AUTOSAVE-001, -003) ──────
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(async () => {
      const session = sessionRef.current;
      if (!session || savingRef.current || !(await session.isDirty())) return;
      try {
        const bytes = await session.export('hwpx');
        const current = docRef.current;
        await putDraft({
          id: current.draftId,
          userSub: user.sub,
          fileName: current.fileName,
          source: {
            kind: current.source.kind,
            driveFileId: current.source.kind === 'drive' ? current.source.snapshot.fileId : undefined,
          },
          savedAt: Date.now(),
          bytes,
        });
        setLastAutosave(Date.now());
      } catch {
        // 자동 저장 실패는 편집을 막지 않는다
      }
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [ready, user.sub]);

  // ── 저장하지 않고 창을 닫을 때 경고 ─────────────────────────
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState !== 'saved') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveState]);

  const requestClose = async () => {
    const dirty = (await sessionRef.current?.isDirty()) ?? false;
    if (dirty || saveState === 'dirty') setConfirmClose(true);
    else closeDoc();
  };

  const statusText =
    saveState === 'saving'
      ? '저장 중…'
      : saveState === 'dirty'
        ? lastAutosave
          ? `저장하지 않은 변경 있음 (임시 저장 ${new Date(lastAutosave).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})`
          : '저장하지 않은 변경 있음'
        : '저장됨';

  const locationText =
    doc.source.kind === 'drive' ? 'Google Drive' : doc.source.kind === 'local' ? '이 크롬북' : '아직 저장하지 않음';

  return (
    <div className="editor-screen">
      <header className="editor-header">
        <button type="button" className="btn btn-ghost" onClick={() => void requestClose()} aria-label="문서 닫고 처음 화면으로">
          ← 처음 화면
        </button>
        <div className="doc-title">
          <strong>{doc.fileName}</strong>
          <span className="muted"> · {locationText}</span>
        </div>
        <span className={`save-state save-${saveState}`} role="status" aria-live="polite">
          {statusText}
        </span>
        <span className="user-chip" title={user.email}>
          {user.name}
        </span>
      </header>

      <div className="editor-toolbar" role="toolbar" aria-label="파일">
        <button type="button" className="btn btn-primary" onClick={save} disabled={!ready || saveState === 'saving'}>
          저장 <kbd>Ctrl+S</kbd>
        </button>
        <button type="button" className="btn" onClick={saveAs} disabled={!ready || saveState === 'saving'}>
          다른 이름으로 저장 <kbd>Ctrl+Shift+S</kbd>
        </button>
        {flags.allowPdfExport && (
          <button type="button" className="btn" onClick={() => void exportPdf()} disabled={!ready}>
            PDF로 내보내기 <kbd>Ctrl+P</kbd>
          </button>
        )}
        <span className="toolbar-spacer" />
        {doc.compat.warnings.length > 0 && !showWarnings && (
          <button type="button" className="btn btn-ghost" onClick={() => setShowWarnings(true)}>
            호환성 안내 {doc.compat.warnings.length}건
          </button>
        )}
      </div>

      {showWarnings && doc.compat.warnings.length > 0 && (
        <div className="warning-banner" role="note">
          <ul>
            {doc.compat.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <button type="button" className="btn btn-ghost" onClick={() => setShowWarnings(false)}>
            닫기
          </button>
        </div>
      )}

      <div className="editor-frame" ref={containerRef} aria-busy={!ready} />

      <footer className="editor-status">
        <span>{pageCount}쪽</span>
        <span>{doc.sourceFormat.toUpperCase()}</span>
        <span className="muted">크롬북에서 편집 · 문서는 학교 서버로 전송되지 않습니다</span>
      </footer>

      {saveDialog && (
        <SaveDialog
          initialName={doc.fileName}
          flags={flags}
          driveEnabled={driveEnabled}
          onCancel={() => setSaveDialog(false)}
          onSave={(choice) => {
            setSaveDialog(false);
            void performSave({ ...choice, mode: 'saveAs' });
          }}
        />
      )}

      {conflict && (
        <div className="overlay" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title">
          <div className="dialog">
            <h2 id="conflict-title">다른 곳에서 파일이 변경되었습니다</h2>
            <p>이 문서를 연 뒤에 다른 사람이나 다른 기기에서 Drive 파일을 고쳤습니다. 덮어쓰면 그 변경이 사라집니다.</p>
            <p className="muted">덮어써도 Drive의 '버전 관리'에서 이전 버전을 되살릴 수 있습니다.</p>
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={() => setConflict(null)}>
                취소
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const c = conflict;
                  setConflict(null);
                  void performSave({ ...c, mode: 'save' }, true);
                }}
              >
                그래도 덮어쓰기
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setConflict(null);
                  setSaveDialog(true);
                }}
              >
                새 파일로 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmClose && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="close-title">
          <div className="dialog">
            <h2 id="close-title">저장하지 않은 변경이 있습니다</h2>
            <p>닫기 전에 저장할까요?</p>
            <div className="dialog-actions">
              <button type="button" className="btn" onClick={() => setConfirmClose(false)}>
                취소
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void deleteDraft(doc.draftId).catch(() => undefined);
                  closeDoc();
                }}
              >
                저장하지 않고 닫기
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setConfirmClose(false);
                  save();
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
