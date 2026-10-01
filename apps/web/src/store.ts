import { create } from 'zustand';
import type { Role } from './auth/role';
import type { AppConfig } from './config/flags';
import type { OpenedDocument } from './documents/documentService';
import type { AppError } from './errors';

export interface User {
  /** Google sub — 내부 사용자 식별자 (FR-AUTH-004) */
  sub: string;
  email: string;
  name: string;
  picture?: string;
  hd: string;
  role: Role;
  /** 개발 서버 전용 테스트 계정 */
  dev?: boolean;
}

export type Screen = 'home' | 'editor' | 'admin' | 'licenses' | 'privacy';

export interface Notice {
  id: number;
  kind: 'info' | 'success' | 'warning';
  text: string;
}

interface AppState {
  config: AppConfig | null;
  user: User | null;
  idToken: string | null;
  screen: Screen;
  doc: OpenedDocument | null;
  error: AppError | null;
  /** 오류 화면의 '다시 시도' 동작 */
  retry: (() => void) | null;
  notices: Notice[];
  busy: string | null;
  updateReady: boolean;

  setConfig(config: AppConfig): void;
  signIn(user: User, idToken: string | null): void;
  signOut(): void;
  go(screen: Screen): void;
  openDoc(doc: OpenedDocument): void;
  updateDoc(patch: Partial<OpenedDocument>): void;
  closeDoc(): void;
  showError(error: AppError | null, retry?: (() => void) | null): void;
  notify(kind: Notice['kind'], text: string): void;
  dismiss(id: number): void;
  setBusy(text: string | null): void;
  setUpdateReady(ready: boolean): void;
}

let noticeSeq = 0;

export const useApp = create<AppState>((set, get) => ({
  config: null,
  user: null,
  idToken: null,
  screen: 'home',
  doc: null,
  error: null,
  retry: null,
  notices: [],
  busy: null,
  updateReady: false,

  setConfig: (config) => set({ config }),
  signIn: (user, idToken) => set({ user, idToken }),
  signOut: () => set({ user: null, idToken: null, screen: 'home', doc: null, error: null, retry: null }),
  go: (screen) => set({ screen }),
  openDoc: (doc) => set({ doc, screen: 'editor', error: null, retry: null }),
  updateDoc: (patch) => {
    const doc = get().doc;
    if (doc) set({ doc: { ...doc, ...patch } });
  },
  closeDoc: () => set({ doc: null, screen: 'home' }),
  showError: (error, retry = null) => set({ error, retry }),
  notify: (kind, text) => {
    const id = ++noticeSeq;
    set({ notices: [...get().notices, { id, kind, text }] });
    setTimeout(() => get().dismiss(id), kind === 'warning' ? 9000 : 4500);
  },
  dismiss: (id) => set({ notices: get().notices.filter((n) => n.id !== id) }),
  setBusy: (busy) => set({ busy }),
  setUpdateReady: (updateReady) => set({ updateReady }),
}));
