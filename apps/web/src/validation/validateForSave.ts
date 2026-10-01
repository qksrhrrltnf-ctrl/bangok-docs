import { AppError } from '../errors';
import { inspectDocument, type DocFormat } from './inspect';

/**
 * 저장 직전 검증 (FR-SAVE-005, PRD 19장).
 *
 *   serialize 성공 AND 생성 파일 정적 검증 성공 AND 재파싱 성공
 *
 * 셋 중 하나라도 실패하면 AppError 를 던지고, 호출자는 절대 기존 파일을 덮어쓰지 않는다.
 */

export interface SaveValidation {
  pageCount: number;
  warnings: string[];
}

export type Reparse = (bytes: Uint8Array) => Promise<{ pageCount: number }>;

export async function validateForSave(
  bytes: Uint8Array | null | undefined,
  format: DocFormat,
  reparse: Reparse,
  expected: { pageCount?: number } = {},
): Promise<SaveValidation> {
  if (!bytes || bytes.length === 0) throw new AppError('SAVE_001', '직렬화 결과가 비어 있음');

  let inspection;
  try {
    inspection = inspectDocument(bytes, `validation.${format}`);
  } catch (err) {
    throw new AppError('SAVE_002', err instanceof Error ? err.message : String(err), { cause: err });
  }
  if (inspection.format !== format) {
    throw new AppError('SAVE_002', `요청 형식 ${format}, 생성 형식 ${inspection.format}`);
  }

  let pageCount: number;
  try {
    ({ pageCount } = await reparse(bytes));
  } catch (err) {
    throw new AppError('SAVE_002', `재파싱 실패: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  }
  if (!Number.isFinite(pageCount) || pageCount < 1) {
    throw new AppError('SAVE_002', `재파싱 결과 페이지 수 ${pageCount}`);
  }

  const warnings = inspection.warnings.filter((w) => !w.startsWith('큰 문서'));
  if (expected.pageCount && expected.pageCount !== pageCount) {
    warnings.push(`저장한 파일의 쪽 수(${pageCount})가 편집 화면(${expected.pageCount})과 다릅니다. 저장 후 레이아웃을 확인하세요.`);
  }
  return { pageCount, warnings };
}
