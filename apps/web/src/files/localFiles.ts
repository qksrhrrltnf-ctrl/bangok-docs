import { AppError } from '../errors';
import type { DocFormat } from '../validation/inspect';

/**
 * 크롬북 로컬 파일 열기·저장 (UC-02, FR-SAVE-001).
 * ChromeOS Chrome 은 File System Access API 를 지원해 원래 파일에 다시 저장할 수 있다.
 * 지원하지 않는 브라우저에서는 input[type=file] 과 다운로드로 대체한다.
 */

export interface LocalFile {
  name: string;
  bytes: Uint8Array;
  handle: FileSystemFileHandle | null;
}

const ACCEPT = {
  hwpx: { description: '한글 문서 (HWPX)', accept: { 'application/hwp+zip': ['.hwpx'] } },
  hwp: { description: '한글 문서 (HWP)', accept: { 'application/x-hwp': ['.hwp'] } },
} as const;

type FsWindow = Window & {
  showOpenFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (options?: unknown) => Promise<FileSystemFileHandle>;
};

export function supportsFileSystemAccess(): boolean {
  const w = window as FsWindow;
  return typeof w.showOpenFilePicker === 'function' && typeof w.showSaveFilePicker === 'function';
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export async function readFile(file: File, handle: FileSystemFileHandle | null = null): Promise<LocalFile> {
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()), handle };
}

/** 파일 선택 창을 연다. 취소하면 null. */
export async function openLocalFile(): Promise<LocalFile | null> {
  const w = window as FsWindow;
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: false,
        types: [{ description: '한글 문서 (HWP, HWPX)', accept: { 'application/octet-stream': ['.hwp', '.hwpx'] } }],
      });
      return readFile(await handle.getFile(), handle);
    } catch (err) {
      if (isAbort(err)) return null;
      throw err;
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.hwp,.hwpx';
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await readFile(file) : null);
    };
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

export function replaceExtension(fileName: string, format: DocFormat): string {
  const base = fileName.replace(/\.(hwpx?|pdf)$/i, '').trim() || '새 문서';
  return `${base}.${format}`;
}

/** 원래 파일(핸들)에 덮어쓴다. 검증을 통과한 바이트만 넘길 것 (FR-SAVE-006). */
export async function writeToHandle(handle: FileSystemFileHandle, bytes: Uint8Array): Promise<void> {
  try {
    const writable = await handle.createWritable();
    await writable.write(bytes as FileSystemWriteChunkType);
    await writable.close();
  } catch (err) {
    throw new AppError('SAVE_006', err instanceof Error ? err.message : String(err), { cause: err });
  }
}

/**
 * 새 위치에 저장한다. 저장 위치 선택 창을 쓰고, 지원하지 않으면 다운로드한다.
 * 취소하면 null.
 */
export async function saveAsLocal(
  bytes: Uint8Array,
  suggestedName: string,
  format: DocFormat,
): Promise<{ name: string; handle: FileSystemFileHandle | null } | null> {
  const w = window as FsWindow;
  if (w.showSaveFilePicker) {
    let handle: FileSystemFileHandle;
    try {
      handle = await w.showSaveFilePicker({ suggestedName, types: [ACCEPT[format]] });
    } catch (err) {
      if (isAbort(err)) return null;
      throw new AppError('SAVE_006', err instanceof Error ? err.message : String(err), { cause: err });
    }
    await writeToHandle(handle, bytes);
    return { name: handle.name, handle };
  }
  downloadBytes(bytes, suggestedName, format === 'hwpx' ? 'application/hwp+zip' : 'application/x-hwp');
  return { name: suggestedName, handle: null };
}

export function downloadBytes(bytes: Uint8Array, fileName: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
