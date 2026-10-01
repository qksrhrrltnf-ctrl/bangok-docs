/**
 * 자동 저장 임시 보관소 (FR-AUTOSAVE-001~004).
 * 브라우저 IndexedDB 에만 저장하고 서버로 보내지 않는다.
 * 사용자(sub)별로 나누고, 7일이 지난 임시 문서는 지운다.
 */

export interface DraftSource {
  kind: 'new' | 'local' | 'drive';
  driveFileId?: string;
}

export interface Draft {
  id: string;
  userSub: string;
  fileName: string;
  source: DraftSource;
  savedAt: number;
  bytes: Uint8Array;
}

export type DraftSummary = Omit<Draft, 'bytes'> & { byteLength: number };

const DB_NAME = 'school-hwp';
const STORE = 'drafts';
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('userSub', 'userSub', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      let result: T | undefined;
      if (req) req.onsuccess = () => (result = req.result);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function putDraft(draft: Draft): Promise<void> {
  await withStore('readwrite', (s) => s.put(draft));
}

export async function getDraft(id: string): Promise<Draft | undefined> {
  return withStore<Draft>('readonly', (s) => s.get(id) as IDBRequest<Draft>);
}

export async function deleteDraft(id: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(id));
}

async function allDrafts(userSub: string): Promise<Draft[]> {
  const list = await withStore<Draft[]>('readonly', (s) => s.index('userSub').getAll(userSub) as IDBRequest<Draft[]>);
  return list ?? [];
}

/** 복구 후보 목록. 만료된 항목은 이때 지운다. */
export async function listDrafts(userSub: string, now = Date.now()): Promise<DraftSummary[]> {
  const drafts = await allDrafts(userSub);
  const alive: DraftSummary[] = [];
  for (const d of drafts) {
    if (now - d.savedAt > DRAFT_TTL_MS) {
      await deleteDraft(d.id);
      continue;
    }
    const { bytes, ...rest } = d;
    alive.push({ ...rest, byteLength: bytes.byteLength });
  }
  return alive.sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteAllDrafts(userSub: string): Promise<number> {
  const drafts = await allDrafts(userSub);
  for (const d of drafts) await deleteDraft(d.id);
  return drafts.length;
}
