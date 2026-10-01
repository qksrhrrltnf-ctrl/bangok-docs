import { env } from '../env';

/** PRD 20장 기능 플래그 + 11.3 AppConfig */
export interface FeatureFlags {
  allowHwpOpen: boolean;
  allowHwpSave: boolean;
  allowHwpxOpen: boolean;
  allowHwpxSave: boolean;
  allowPdfExport: boolean;
  allowDriveIntegration: boolean;
  maintenanceMode: boolean;
}

/** 역할 판별 설정 (FR-AUTH-006). 이메일 주소 자체는 서버 DB에 저장하지 않는다. */
export interface RoleConfig {
  adminEmails: string[];
  teacherEmails: string[];
  /** 교직원 계정을 가리키는 정규식 (예: "^t\\d+@"). 비우면 사용하지 않는다. */
  teacherEmailPattern: string;
}

export interface AppConfig {
  flags: FeatureFlags;
  roles: RoleConfig;
  maintenanceMessage: string;
  /** 설정을 어디서 받았는지 (관리자 화면 표시용) */
  source: 'api' | 'static' | 'cache' | 'default';
}

/** 백엔드와 설정 파일을 모두 받을 수 없을 때 쓰는 안전한 기본값 */
export const DEFAULT_FLAGS: FeatureFlags = {
  allowHwpOpen: true,
  allowHwpSave: false,
  allowHwpxOpen: true,
  allowHwpxSave: true,
  allowPdfExport: true,
  allowDriveIntegration: true,
  maintenanceMode: false,
};

export const DEFAULT_ROLES: RoleConfig = { adminEmails: [], teacherEmails: [], teacherEmailPattern: '' };

const CACHE_KEY = 'school-hwp:config:v1';

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((s) => s.trim().toLowerCase()) : [];
}

/** 알 수 없는 키와 잘못된 타입은 버리고 기본값으로 채운다. */
export function normalizeConfig(raw: unknown, source: AppConfig['source']): AppConfig {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawFlags = (obj.flags && typeof obj.flags === 'object' ? obj.flags : obj) as Record<string, unknown>;
  const flags = { ...DEFAULT_FLAGS };
  for (const key of Object.keys(DEFAULT_FLAGS) as (keyof FeatureFlags)[]) {
    if (typeof rawFlags[key] === 'boolean') flags[key] = rawFlags[key] as boolean;
  }
  const rawRoles = (obj.roles && typeof obj.roles === 'object' ? obj.roles : {}) as Record<string, unknown>;
  const roles: RoleConfig = {
    adminEmails: asStringArray(rawRoles.adminEmails),
    teacherEmails: asStringArray(rawRoles.teacherEmails),
    teacherEmailPattern: typeof rawRoles.teacherEmailPattern === 'string' ? rawRoles.teacherEmailPattern : '',
  };
  const maintenanceMessage =
    typeof obj.maintenanceMessage === 'string' ? obj.maintenanceMessage : '점검 중입니다. 잠시 후 다시 시도해 주세요.';
  return { flags, roles, maintenanceMessage, source };
}

async function fetchJson(url: string, timeoutMs: number, init?: RequestInit): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function readCache(): AppConfig | null {
  try {
    const text = localStorage.getItem(CACHE_KEY);
    return text ? normalizeConfig(JSON.parse(text), 'cache') : null;
  } catch {
    return null;
  }
}

function writeCache(config: AppConfig): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ flags: config.flags, roles: config.roles, maintenanceMessage: config.maintenanceMessage }));
  } catch {
    // 저장 공간이 없어도 앱은 동작해야 한다
  }
}

/**
 * 설정 로드 순서 (FR-OFFLINE-002):
 * 1. 백엔드 API (VITE_API_BASE 가 있을 때)
 * 2. 정적 /config.json (배포 시 함께 올린다)
 * 3. 마지막으로 받은 값 (localStorage)
 * 4. 내장 기본값
 */
export async function loadConfig(): Promise<AppConfig> {
  if (env.apiBase) {
    try {
      const config = normalizeConfig(await fetchJson(`${env.apiBase}/config`, 3000), 'api');
      writeCache(config);
      return config;
    } catch {
      // 다음 단계로
    }
  }
  try {
    const config = normalizeConfig(await fetchJson('/config.json', 3000), 'static');
    writeCache(config);
    return config;
  } catch {
    // 다음 단계로
  }
  return readCache() ?? normalizeConfig({}, 'default');
}
