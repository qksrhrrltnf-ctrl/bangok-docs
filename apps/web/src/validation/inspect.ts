import { AppError } from '../errors';
import { LIMITS, type Limits } from './limits';

/**
 * 문서 파일을 엔진(WASM)에 넘기기 전에 하는 정적 검사 (SEC-008).
 * - 형식 판별: 확장자가 아니라 파일 시그니처 기준
 * - 크기 제한, ZIP bomb(압축 해제 크기·압축률·항목 수), 이미지 개수·크기
 * 파일 내용 자체는 어디에도 보내지 않는다.
 */

export type DocFormat = 'hwpx' | 'hwp';

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

export interface DocumentInspection {
  format: DocFormat;
  byteLength: number;
  /** HWPX 전용 */
  entryCount?: number;
  uncompressedBytes?: number;
  imageCount?: number;
  warnings: string[];
}

const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];
const HWP3_SIGNATURE = 'HWP Document File';
const HWPX_MIMETYPE = 'application/hwp+zip';
const IMAGE_DIR = /^BinData\//i;

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((b, i) => bytes[i] === b);
}

export function detectFormat(bytes: Uint8Array): DocFormat | null {
  if (startsWith(bytes, ZIP_SIGNATURE)) return 'hwpx';
  if (startsWith(bytes, OLE_SIGNATURE)) return 'hwp';
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, HWP3_SIGNATURE.length));
  if (head === HWP3_SIGNATURE) return 'hwp';
  return null;
}

export function extensionOf(fileName: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(fileName.trim());
  return m ? m[1].toLowerCase() : '';
}

/** ZIP 중앙 디렉터리를 읽는다. 압축은 풀지 않는다. */
export function readZipDirectory(bytes: Uint8Array, limits: Limits = LIMITS): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 22) throw new AppError('DOC_002', 'ZIP 크기가 너무 작음');

  let eocd = -1;
  const minPos = Math.max(0, bytes.length - 22 - 0xffff);
  for (let i = bytes.length - 22; i >= minPos; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new AppError('DOC_002', 'ZIP 끝 레코드 없음');

  const total = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (total === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    throw new AppError('DOC_003', 'ZIP64 형식은 허용하지 않음');
  }
  if (total > limits.maxZipEntries) throw new AppError('DOC_003', `ZIP 항목 수 ${total}`);
  if (cdOffset + cdSize > eocd) throw new AppError('DOC_002', 'ZIP 중앙 디렉터리 범위 오류');

  const decoder = new TextDecoder('utf-8');
  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let k = 0; k < total; k++) {
    if (p + 46 > eocd || view.getUint32(p, true) !== 0x02014b50) {
      throw new AppError('DOC_002', 'ZIP 중앙 디렉터리 항목 오류');
    }
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const uncompressedSize = view.getUint32(p + 24, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localHeaderOffset = view.getUint32(p + 42, true);
    const nameEnd = p + 46 + nameLen;
    if (nameEnd > eocd) throw new AppError('DOC_002', 'ZIP 파일 이름 범위 오류');
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new AppError('DOC_003', 'ZIP64 항목은 허용하지 않음');
    }
    entries.push({
      name: decoder.decode(bytes.subarray(p + 46, nameEnd)),
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    p = nameEnd + extraLen + commentLen;
  }
  return entries;
}

function readStoredEntry(bytes: Uint8Array, entry: ZipEntry): Uint8Array | null {
  if (entry.method !== 0) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const o = entry.localHeaderOffset;
  if (o + 30 > bytes.length || view.getUint32(o, true) !== 0x04034b50) return null;
  const start = o + 30 + view.getUint16(o + 26, true) + view.getUint16(o + 28, true);
  const end = start + entry.compressedSize;
  if (end > bytes.length) return null;
  return bytes.subarray(start, end);
}

function inspectHwpx(bytes: Uint8Array, limits: Limits, warnings: string[]): Omit<DocumentInspection, 'format' | 'byteLength' | 'warnings'> {
  const entries = readZipDirectory(bytes, limits);
  const names = new Set(entries.map((e) => e.name));
  if (!names.has('mimetype') || !entries.some((e) => /^Contents\/section\d+\.xml$/i.test(e.name))) {
    throw new AppError('DOC_002', 'HWPX 필수 항목(mimetype, Contents/section*.xml) 없음');
  }

  const mimetypeEntry = entries.find((e) => e.name === 'mimetype')!;
  const mimetype = readStoredEntry(bytes, mimetypeEntry);
  if (mimetype && new TextDecoder().decode(mimetype).trim() !== HWPX_MIMETYPE) {
    warnings.push('HWPX mimetype 값이 표준과 다릅니다.');
  }

  let uncompressedBytes = 0;
  let imageCount = 0;
  for (const e of entries) {
    uncompressedBytes += e.uncompressedSize;
    if (uncompressedBytes > limits.maxUncompressedBytes) {
      throw new AppError('DOC_003', '압축 해제 후 크기 제한 초과');
    }
    if (
      e.uncompressedSize >= limits.compressionRatioMinBytes &&
      e.uncompressedSize / Math.max(1, e.compressedSize) > limits.maxCompressionRatio
    ) {
      throw new AppError('DOC_003', `비정상 압축률 항목: ${e.name}`);
    }
    if (IMAGE_DIR.test(e.name) && !e.name.endsWith('/')) {
      imageCount++;
      if (e.uncompressedSize > limits.maxSingleImageBytes) {
        throw new AppError('DOC_003', `이미지 크기 제한 초과: ${e.name}`);
      }
    }
  }
  if (imageCount > limits.maxImages) throw new AppError('DOC_003', `이미지 ${imageCount}개`);

  return { entryCount: entries.length, uncompressedBytes, imageCount };
}

export function inspectDocument(bytes: Uint8Array, fileName: string, limits: Limits = LIMITS): DocumentInspection {
  if (bytes.length === 0) throw new AppError('DOC_002', '빈 파일');
  if (bytes.length > limits.maxFileBytes) throw new AppError('DOC_003', `${bytes.length} bytes`);

  const ext = extensionOf(fileName);
  if (ext !== 'hwp' && ext !== 'hwpx') throw new AppError('DOC_004', ext || '확장자 없음');

  const format = detectFormat(bytes);
  if (!format) throw new AppError('DOC_002', '알 수 없는 파일 시그니처');

  const warnings: string[] = [];
  if (format !== ext) {
    warnings.push(`파일 확장자는 .${ext}이지만 실제 형식은 ${format.toUpperCase()}입니다.`);
  }
  if (bytes.length > limits.largeDocumentWarnBytes) {
    warnings.push('큰 문서입니다. 여는 데 시간이 걸릴 수 있습니다.');
  }

  const extra = format === 'hwpx' ? inspectHwpx(bytes, limits, warnings) : {};
  return { format, byteLength: bytes.length, warnings, ...extra };
}
