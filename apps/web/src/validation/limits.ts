export interface Limits {
  maxFileBytes: number;
  maxImages: number;
  maxSingleImageBytes: number;
  maxUncompressedBytes: number;
  maxZipEntries: number;
  maxCompressionRatio: number;
  compressionRatioMinBytes: number;
  largeDocumentWarnBytes: number;
  parseTimeoutMs: number;
}

/** PRD 13장 파일 제한 초기값. Pilot 결과에 따라 조정한다. */
export const LIMITS: Readonly<Limits> = {
  maxFileBytes: 50 * 1024 * 1024,
  maxImages: 200,
  maxSingleImageBytes: 20 * 1024 * 1024,
  maxUncompressedBytes: 250 * 1024 * 1024,
  /** 비정상적으로 많은 ZIP 항목은 ZIP bomb 으로 본다 */
  maxZipEntries: 10_000,
  /** 항목 하나의 압축률이 이 값을 넘고 크기가 큰 경우 ZIP bomb 으로 본다 */
  maxCompressionRatio: 200,
  compressionRatioMinBytes: 10 * 1024 * 1024,
  /** 이 크기를 넘으면 '큰 문서' 경고를 보여 준다 (PRD 14장) */
  largeDocumentWarnBytes: 10 * 1024 * 1024,
  /** 문서 파싱 제한 시간 (PRD 14장) */
  parseTimeoutMs: 45_000,
};
