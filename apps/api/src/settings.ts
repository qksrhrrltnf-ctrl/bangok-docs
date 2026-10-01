/**
 * 서버 설정. 비밀 값은 소스에 두지 않고 Cloud Run 환경 변수 / Secret Manager 로 넣는다 (SEC-002, SEC-003).
 * 이 API 는 ID 토큰 검증만 하므로 OAuth 클라이언트 비밀(secret)이 필요 없다.
 */
export interface Settings {
  port: number;
  googleClientId: string;
  allowedDomain: string;
  adminEmails: string[];
  teacherEmails: string[];
  teacherEmailPattern: string;
  /** CORS 허용 출처. Firebase Hosting 에서 /api 를 같은 출처로 연결하면 비워 둔다. */
  allowedOrigins: string[];
  store: 'firestore' | 'memory';
  /** 이벤트 보존 기간 (Firestore TTL 필드 expireAt 계산용, SEC-009) */
  eventRetentionDays: number;
}

function list(v: string | undefined): string[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  const settings: Settings = {
    port: Number(env.PORT ?? 8080),
    googleClientId: env.GOOGLE_CLIENT_ID ?? '',
    allowedDomain: (env.ALLOWED_DOMAIN ?? '').toLowerCase(),
    adminEmails: list(env.ADMIN_EMAILS),
    teacherEmails: list(env.TEACHER_EMAILS),
    teacherEmailPattern: env.TEACHER_EMAIL_PATTERN ?? '',
    allowedOrigins: list(env.ALLOWED_ORIGINS),
    store: env.STORE === 'memory' ? 'memory' : 'firestore',
    eventRetentionDays: Number(env.EVENT_RETENTION_DAYS ?? 90),
  };
  if (!settings.googleClientId || !settings.allowedDomain) {
    throw new Error('GOOGLE_CLIENT_ID 와 ALLOWED_DOMAIN 환경 변수가 필요합니다');
  }
  return settings;
}
