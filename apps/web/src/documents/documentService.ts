import type { FeatureFlags } from '../config/flags';
import { MIME, snapshotOf, type DriveClient, type DriveSnapshot } from '../drive/driveClient';
import { createBlankHwpx, parseDocument } from '../engine/engine';
import { AppError } from '../errors';
import { replaceExtension, saveAsLocal, writeToHandle } from '../files/localFiles';
import { buildCompatReport, type CompatReport } from '../validation/compatWarnings';
import { extensionOf, inspectDocument, type DocFormat } from '../validation/inspect';
import { validateForSave } from '../validation/validateForSave';

/**
 * 문서 열기·새로 만들기·저장 흐름. 화면(React)과 분리해 테스트할 수 있게 했다.
 */

export type DocSource =
  | { kind: 'new' }
  | { kind: 'local'; handle: FileSystemFileHandle | null }
  | { kind: 'drive'; snapshot: DriveSnapshot };

export interface OpenedDocument {
  /** 자동 저장 임시 문서의 키 */
  draftId: string;
  fileName: string;
  /** 지금 열려 있는 파일의 형식 */
  sourceFormat: DocFormat;
  source: DocSource;
  bytes: Uint8Array;
  compat: CompatReport;
  pageCount: number;
}

export const NEW_DOCUMENT_NAME = '새 문서.hwpx';

function emptyCompat(): CompatReport {
  return { warnings: [], fontsUsed: [], substitutedFonts: [], lossCount: 0 };
}

/** 파일을 편집기에 넘기기 전에 검사하고, 호환성 경고를 만든다. */
export async function prepareDocument(
  bytes: Uint8Array,
  fileName: string,
  source: DocSource,
  flags: FeatureFlags,
  draftId: string = crypto.randomUUID(),
): Promise<OpenedDocument> {
  const inspection = inspectDocument(bytes, fileName);
  if (inspection.format === 'hwp' && !flags.allowHwpOpen) {
    throw new AppError('DOC_001', 'HWP 열기 기능이 꺼져 있습니다');
  }
  if (inspection.format === 'hwpx' && !flags.allowHwpxOpen) {
    throw new AppError('DOC_004', 'HWPX 열기 기능이 꺼져 있습니다');
  }
  const parsed = await parseDocument(bytes, { lossCheck: 'hwpx' });
  if (parsed.pageCount < 1) {
    throw new AppError(inspection.format === 'hwp' ? 'DOC_001' : 'DOC_002', '페이지가 없는 문서');
  }
  const compat = buildCompatReport({
    sourceFormat: inspection.format,
    inspectionWarnings: inspection.warnings,
    info: parsed.info,
    loss: parsed.loss,
  });
  return {
    draftId,
    fileName,
    sourceFormat: inspection.format,
    source,
    bytes,
    compat,
    pageCount: parsed.pageCount,
  };
}

/** 빈 A4 HWPX 문서 (UC-01, FR-DOC-001~003) */
export async function prepareNewDocument(): Promise<OpenedDocument> {
  const bytes = await createBlankHwpx();
  return {
    draftId: crypto.randomUUID(),
    fileName: NEW_DOCUMENT_NAME,
    sourceFormat: 'hwpx',
    source: { kind: 'new' },
    bytes,
    compat: emptyCompat(),
    pageCount: 1,
  };
}

export interface ExportSource {
  export(format: DocFormat): Promise<Uint8Array>;
  pageCount(): Promise<number>;
  markSaved(fileName: string): Promise<void>;
}

export type Destination = 'drive' | 'local';

export interface SaveRequest {
  editor: ExportSource;
  doc: Pick<OpenedDocument, 'fileName' | 'sourceFormat' | 'source'>;
  format: DocFormat;
  destination: Destination;
  /** save: 가능하면 원래 파일에 덮어쓰기, saveAs: 항상 새 파일 */
  mode: 'save' | 'saveAs';
  fileName: string;
  driveFolderId?: string;
  /** 충돌 경고 후 사용자가 명시적으로 덮어쓰기를 고른 경우 */
  force?: boolean;
  flags: FeatureFlags;
  drive: DriveClient | null;
}

export interface SaveResult {
  fileName: string;
  sourceFormat: DocFormat;
  source: DocSource;
  destination: Destination;
  warnings: string[];
  byteLength: number;
}

/** 원래 파일에 그대로 덮어쓸 수 있는지. 형식이 바뀌면 새 파일로 저장해야 한다. */
export function canOverwrite(doc: SaveRequest['doc'], format: DocFormat, destination: Destination): boolean {
  if (format !== doc.sourceFormat || extensionOf(doc.fileName) !== format) return false;
  if (destination === 'drive') return doc.source.kind === 'drive';
  return doc.source.kind === 'local' && doc.source.handle !== null;
}

export function assertSaveAllowed(format: DocFormat, flags: FeatureFlags, destination: Destination): void {
  if (format === 'hwpx' && !flags.allowHwpxSave) throw new AppError('SAVE_007', 'HWPX 저장');
  if (format === 'hwp' && !flags.allowHwpSave) throw new AppError('SAVE_007', 'HWP 호환 저장');
  if (destination === 'drive' && !flags.allowDriveIntegration) throw new AppError('SAVE_007', 'Google Drive 연동');
}

/**
 * 저장 (FR-SAVE-001~008, PRD 19장).
 *   편집기 직렬화 → 생성 파일 검증 → 재파싱 → (모두 성공 시에만) 실제 쓰기
 * 사용자가 저장 위치 선택을 취소하면 null.
 */
export async function saveDocument(req: SaveRequest): Promise<SaveResult | null> {
  assertSaveAllowed(req.format, req.flags, req.destination);

  const bytes = await req.editor.export(req.format);
  const editorPages = await req.editor.pageCount().catch(() => undefined);
  const validation = await validateForSave(bytes, req.format, (b) => parseDocument(b), { pageCount: editorPages });

  const overwrite = req.mode === 'save' && canOverwrite(req.doc, req.format, req.destination);
  const targetName = overwrite ? req.doc.fileName : replaceExtension(req.fileName, req.format);
  let fileName = targetName;
  let source: DocSource;

  if (req.destination === 'drive') {
    if (!req.drive) throw new AppError('SAVE_007', 'Google Drive 설정 없음');
    if (overwrite && req.doc.source.kind === 'drive') {
      const updated = await req.drive.update(req.doc.source.snapshot, { bytes, mimeType: MIME[req.format] }, { force: req.force });
      fileName = updated.name;
      source = { kind: 'drive', snapshot: snapshotOf(updated) };
    } else {
      const created = await req.drive.create({
        name: targetName,
        mimeType: MIME[req.format],
        bytes,
        parentId: req.driveFolderId,
      });
      fileName = created.name;
      source = { kind: 'drive', snapshot: snapshotOf(created) };
    }
  } else if (overwrite && req.doc.source.kind === 'local' && req.doc.source.handle) {
    await writeToHandle(req.doc.source.handle, bytes);
    source = req.doc.source;
  } else {
    const saved = await saveAsLocal(bytes, targetName, req.format);
    if (!saved) return null;
    fileName = saved.name;
    source = { kind: 'local', handle: saved.handle };
  }

  await req.editor.markSaved(fileName);
  return {
    fileName,
    sourceFormat: req.format,
    source,
    destination: req.destination,
    warnings: validation.warnings,
    byteLength: bytes.length,
  };
}
