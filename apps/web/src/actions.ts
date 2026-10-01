import { deleteAllDrafts, getDraft } from './autosave/draftStore';
import { disableGoogleAutoSelect } from './auth/googleSignIn';
import { prepareDocument, prepareNewDocument, type DocSource, type OpenedDocument } from './documents/documentService';
import { snapshotOf } from './drive/driveClient';
import { getDriveClient } from './drive/driveService';
import { pickDocument } from './drive/picker';
import { shutdownEngine } from './engine/engine';
import { AppError, toAppError } from './errors';
import { openLocalFile, readFile } from './files/localFiles';
import { getDriveAccessToken, revokeDriveToken } from './google/driveToken';
import { addRecent, removeRecent } from './recent/recentDocs';
import { useApp } from './store';
import { sizeBucket, track } from './telemetry/events';
import { extensionOf } from './validation/inspect';

/** 화면에서 부르는 문서 열기 동작. 오류는 공통 오류 화면으로 보낸다. */

function flags() {
  const config = useApp.getState().config;
  if (!config) throw new AppError('APP_001', '설정을 불러오지 못함');
  return config.flags;
}

async function withBusy<T>(label: string, fn: () => Promise<T>, retry?: () => void): Promise<T | undefined> {
  const app = useApp.getState();
  app.setBusy(label);
  try {
    return await fn();
  } catch (err) {
    const error = toAppError(err);
    app.showError(error, retry ?? null);
    return undefined;
  } finally {
    useApp.getState().setBusy(null);
  }
}

async function openBytes(bytes: Uint8Array, fileName: string, source: DocSource, draftId?: string): Promise<void> {
  const started = performance.now();
  try {
    const doc = await prepareDocument(bytes, fileName, source, flags(), draftId);
    useApp.getState().openDoc(doc);
    track('file_open', { format: doc.sourceFormat, sizeBucket: sizeBucket(bytes.length), durationMs: Math.round(performance.now() - started) });
  } catch (err) {
    const error = toAppError(err, 'DOC_002');
    const ext = extensionOf(fileName);
    track('file_open_failed', { errorCode: error.code, format: ext === 'hwp' || ext === 'hwpx' ? ext : undefined });
    throw error;
  }
}

export function newDocument(): Promise<void | undefined> {
  return withBusy('새 문서를 만드는 중…', async () => {
    const doc = await prepareNewDocument();
    useApp.getState().openDoc(doc);
  }, () => void newDocument());
}

export function openFromDevice(): Promise<void | undefined> {
  return withBusy('파일을 여는 중…', async () => {
    const file = await openLocalFile();
    if (!file) return;
    await openBytes(file.bytes, file.name, { kind: 'local', handle: file.handle });
  });
}

/** 끌어다 놓기 (FR-OPEN-002) */
export function openDroppedFile(file: File, handle: FileSystemFileHandle | null = null): Promise<void | undefined> {
  return withBusy('파일을 여는 중…', async () => {
    const local = await readFile(file, handle);
    await openBytes(local.bytes, local.name, { kind: 'local', handle: local.handle });
  });
}

async function openDriveFile(fileId: string): Promise<void> {
  const app = useApp.getState();
  const drive = getDriveClient(flags().allowDriveIntegration);
  if (!drive) throw new AppError('SAVE_007', 'Google Drive 연동이 설정되지 않았습니다');
  const { file, bytes } = await drive.download(fileId);
  await openBytes(bytes, file.name, { kind: 'drive', snapshot: snapshotOf(file) });
  if (app.user) addRecent(app.user.sub, { driveFileId: file.id, name: file.name });
}

/** Drive 에서 열기 (UC-04) */
export function openFromDrive(): Promise<void | undefined> {
  return withBusy('Google Drive를 여는 중…', async () => {
    const token = await getDriveAccessToken();
    useApp.getState().setBusy(null);
    const picked = await pickDocument(token);
    if (!picked) return;
    const ext = extensionOf(picked.name);
    if (ext !== 'hwp' && ext !== 'hwpx') throw new AppError('DOC_004', picked.name.slice(-12));
    useApp.getState().setBusy('Google Drive에서 가져오는 중…');
    await openDriveFile(picked.id);
  });
}

export function openRecent(driveFileId: string): Promise<void | undefined> {
  return withBusy('Google Drive에서 가져오는 중…', async () => {
    try {
      await openDriveFile(driveFileId);
    } catch (err) {
      const error = toAppError(err, 'DRIVE_002');
      const user = useApp.getState().user;
      if (user && (error.code === 'DRIVE_002' || error.code === 'DRIVE_003')) removeRecent(user.sub, driveFileId);
      throw error;
    }
  }, () => void openRecent(driveFileId));
}

/** 자동 저장된 임시 문서 복구 (FR-AUTOSAVE-002) */
export function restoreDraft(draftId: string): Promise<void | undefined> {
  return withBusy('임시 저장 문서를 여는 중…', async () => {
    const draft = await getDraft(draftId);
    if (!draft) throw new AppError('DOC_002', '임시 문서를 찾을 수 없음');
    // 복구본은 HWPX 로 보관한다. 원래 Drive 파일에 바로 덮어쓰지 않도록 새 문서로 연다.
    const name = draft.fileName.replace(/\.(hwpx?)$/i, '') + ' (복구).hwpx';
    const doc: OpenedDocument = await prepareDocument(draft.bytes, name, { kind: 'new' }, flags(), draft.id);
    useApp.getState().openDoc(doc);
  });
}

/** 로그아웃 (FR-AUTH-005, FR-AUTOSAVE-004) */
export async function signOut(options: { deleteDrafts: boolean }): Promise<void> {
  const user = useApp.getState().user;
  if (user && options.deleteDrafts) {
    try {
      await deleteAllDrafts(user.sub);
    } catch {
      // 임시 문서 삭제 실패는 로그아웃을 막지 않는다
    }
  }
  revokeDriveToken();
  disableGoogleAutoSelect();
  shutdownEngine();
  try {
    sessionStorage.clear();
  } catch {
    // 무시
  }
  useApp.getState().signOut();
}
