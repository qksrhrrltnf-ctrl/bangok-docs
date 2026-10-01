/** PRD 24장 오류 코드. 사용자 화면과 오류 이벤트에 같은 코드를 쓴다. */
export const ERROR_CODES = {
  AUTH_001: '학교 계정이 아닙니다',
  AUTH_002: '로그인하지 못했습니다',
  AUTH_003: '로그인이 만료되었습니다',
  DOC_001: '지원하지 않는 HWP 문서입니다',
  DOC_002: '파일이 손상되었거나 문서 형식이 아닙니다',
  DOC_003: '파일이 너무 큽니다',
  DOC_004: 'HWP 또는 HWPX 파일만 열 수 있습니다',
  DOC_005: '문서를 여는 데 시간이 너무 오래 걸립니다',
  DOC_006: '비밀번호가 걸린 문서는 아직 열 수 없습니다',
  SAVE_001: '문서를 파일로 변환하지 못했습니다',
  SAVE_002: '저장할 파일의 검증에 실패했습니다',
  SAVE_003: 'Google Drive에 저장하지 못했습니다',
  SAVE_004: '다른 곳에서 파일이 변경되었습니다',
  SAVE_005: '인터넷에 연결되어 있지 않습니다',
  SAVE_006: '이 기기에 저장하지 못했습니다',
  SAVE_007: '이 형식으로 저장하는 기능이 꺼져 있습니다',
  PDF_001: 'PDF를 만들지 못했습니다',
  DRIVE_001: 'Google Drive 파일 선택 창을 열지 못했습니다',
  DRIVE_002: 'Google Drive에서 파일을 가져오지 못했습니다',
  DRIVE_003: 'Google Drive 권한이 없습니다',
  EDITOR_001: '편집기를 불러오지 못했습니다',
  APP_001: '예상하지 못한 오류가 발생했습니다',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly detail?: string;
  readonly occurredAt: Date;

  constructor(code: ErrorCode, detail?: string, options?: { cause?: unknown }) {
    super(`${code}: ${ERROR_CODES[code]}${detail ? ` (${detail})` : ''}`, options);
    this.name = 'AppError';
    this.code = code;
    this.detail = detail;
    this.occurredAt = new Date();
  }

  get userMessage(): string {
    return ERROR_CODES[this.code];
  }
}

export function toAppError(error: unknown, fallback: ErrorCode = 'APP_001'): AppError {
  if (error instanceof AppError) return error;
  const detail = error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;
  return new AppError(fallback, detail, { cause: error });
}
