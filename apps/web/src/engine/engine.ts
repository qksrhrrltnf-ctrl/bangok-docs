import { STUDIO_PATH } from '../env';
import { AppError } from '../errors';
import { LIMITS } from '../validation/limits';
import type { EngineRequest, EngineResponse } from './rhwp.worker';

/**
 * 문서 엔진 워커 클라이언트.
 * WASM 파일은 자체 호스팅한 편집기(/studio/)가 쓰는 것과 같은 파일을 재사용한다.
 * (scripts/build-studio.mjs 가 studio-manifest.json 에 경로를 기록)
 */

interface StudioManifest {
  rhwpVersion: string;
  wasm: string;
}

type Pending = {
  resolve: (r: Extract<EngineResponse, { ok: true }>) => void;
  reject: (e: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

let worker: Worker | null = null;
let initPromise: Promise<void> | null = null;
let manifestPromise: Promise<StudioManifest> | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

export function loadStudioManifest(): Promise<StudioManifest> {
  manifestPromise ??= fetch(`${STUDIO_PATH}studio-manifest.json`, { cache: 'no-cache' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`studio-manifest.json HTTP ${res.status}`);
      return (await res.json()) as StudioManifest;
    })
    .catch((err) => {
      manifestPromise = null;
      throw new AppError('EDITOR_001', '편집기 빌드가 없습니다. npm run build:studio 를 실행하세요.', { cause: err });
    });
  return manifestPromise;
}

function resetWorker(reason: AppError): void {
  worker?.terminate();
  worker = null;
  initPromise = null;
  for (const [id, p] of pending) {
    clearTimeout(p.timer);
    p.reject(reason);
    pending.delete(id);
  }
}

function spawn(): Worker {
  const w = new Worker(new URL('./rhwp.worker.ts', import.meta.url), { type: 'module', name: 'rhwp-engine' });
  w.onmessage = (event: MessageEvent<EngineResponse>) => {
    const msg = event.data;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.ok) p.resolve(msg);
    else p.reject(new Error(msg.message));
  };
  w.onerror = (event) => {
    event.preventDefault();
    resetWorker(new AppError('DOC_002', `문서 엔진 오류: ${event.message || '알 수 없음'}`));
  };
  return w;
}

type RequestBody = EngineRequest extends infer R ? (R extends { id: number } ? Omit<R, 'id'> : never) : never;

function request(body: RequestBody, timeoutMs: number, transfer: Transferable[] = []) {
  worker ??= spawn();
  const id = ++seq;
  const w = worker;
  return new Promise<Extract<EngineResponse, { ok: true }>>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      // 멈춘 파서는 워커째 종료해 메모리를 돌려받는다.
      resetWorker(new AppError('DOC_005'));
      reject(new AppError('DOC_005'));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ ...body, id }, transfer);
  });
}

async function ensureReady(): Promise<void> {
  initPromise ??= (async () => {
    const manifest = await loadStudioManifest();
    await request({ type: 'init', wasmUrl: `${STUDIO_PATH}${manifest.wasm}` }, 60_000);
  })().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

export interface ParseResult {
  pageCount: number;
  info: unknown;
  loss: unknown;
}

/** 문서를 엔진으로 다시 읽어 본다. 입력 버퍼는 복사해서 보낸다. */
export async function parseDocument(
  bytes: Uint8Array,
  options: { timeoutMs?: number; lossCheck?: 'hwpx' | 'hwp' } = {},
): Promise<ParseResult> {
  await ensureReady();
  const copy = bytes.slice();
  try {
    const res = await request(
      { type: 'parse', bytes: copy, lossCheck: options.lossCheck },
      options.timeoutMs ?? LIMITS.parseTimeoutMs,
      [copy.buffer],
    );
    return { pageCount: res.pageCount ?? 0, info: res.info ?? null, loss: res.loss ?? null };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('비밀번호')) throw new AppError('DOC_006', undefined, { cause: err });
    throw new AppError('DOC_002', message, { cause: err });
  }
}

/** 한글 호환 빈 A4 문서를 HWPX 로 만든다 (FR-DOC-001~003). */
export async function createBlankHwpx(): Promise<Uint8Array> {
  await ensureReady();
  const res = await request({ type: 'blank' }, 30_000);
  if (!res.bytes || res.bytes.length === 0) throw new AppError('SAVE_001', '빈 문서 생성 실패');
  return res.bytes;
}

/** 테스트·로그아웃용: 워커를 종료한다. */
export function shutdownEngine(): void {
  resetWorker(new AppError('APP_001', 'engine shutdown'));
}
