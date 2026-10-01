import { AppError, type ErrorCode } from '../errors';
import { LIMITS } from '../validation/limits';

/**
 * Google Drive REST v3 래퍼 (PRD 7.5, Rule 2: Drive 기능 분리).
 * fetch 와 토큰 공급자를 주입받아 테스트할 수 있게 했다.
 */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  headRevisionId?: string;
  version?: string;
  parents?: string[];
  trashed?: boolean;
  capabilities?: { canEdit?: boolean };
}

/** 파일을 연 시점의 상태. 덮어쓰기 전 충돌 감지에 쓴다 (FR-SAVE-007). */
export interface DriveSnapshot {
  fileId: string;
  name: string;
  headRevisionId?: string;
  modifiedTime?: string;
  version?: string;
}

export interface DriveDeps {
  fetch: typeof fetch;
  getToken: () => Promise<string>;
  /** 401 을 받으면 호출된다. 다음 getToken 에서 새 토큰을 받게 한다. */
  onUnauthorized?: () => void;
  isOnline?: () => boolean;
}

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FIELDS = 'id,name,mimeType,size,modifiedTime,headRevisionId,version,parents,trashed,capabilities(canEdit)';

export const MIME = {
  hwpx: 'application/hwp+zip',
  hwp: 'application/x-hwp',
} as const;

export function snapshotOf(file: DriveFile): DriveSnapshot {
  return {
    fileId: file.id,
    name: file.name,
    headRevisionId: file.headRevisionId,
    modifiedTime: file.modifiedTime,
    version: file.version,
  };
}

/** 연 뒤에 다른 곳에서 바뀌었는지 판단한다. 리비전 ID 가 있으면 그것을, 없으면 수정 시각을 비교한다. */
export function hasChangedSince(snapshot: DriveSnapshot, current: DriveFile): boolean {
  if (snapshot.headRevisionId && current.headRevisionId) {
    return snapshot.headRevisionId !== current.headRevisionId;
  }
  if (snapshot.modifiedTime && current.modifiedTime) {
    return snapshot.modifiedTime !== current.modifiedTime;
  }
  if (snapshot.version && current.version) return snapshot.version !== current.version;
  // 비교할 값이 없으면 안전하게 '바뀜'으로 본다
  return true;
}

export class DriveClient {
  constructor(private readonly deps: DriveDeps) {}

  private async call(url: string, init: RequestInit, failCode: ErrorCode, retried = false): Promise<Response> {
    const token = await this.deps.getToken();
    let res: Response;
    try {
      res = await this.deps.fetch(url, {
        ...init,
        headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      const online = this.deps.isOnline ? this.deps.isOnline() : true;
      throw new AppError(online ? failCode : 'SAVE_005', err instanceof Error ? err.message : String(err), { cause: err });
    }
    if (res.status === 401 && !retried) {
      this.deps.onUnauthorized?.();
      return this.call(url, init, failCode, true);
    }
    if (!res.ok) {
      let reason = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        if (body.error?.message) reason += ` ${body.error.message}`;
      } catch {
        // 본문이 JSON 이 아니면 상태 코드만 쓴다
      }
      if (res.status === 401) throw new AppError('AUTH_003', reason);
      if (res.status === 403) throw new AppError('DRIVE_003', reason);
      throw new AppError(failCode, reason);
    }
    return res;
  }

  async getMetadata(fileId: string): Promise<DriveFile> {
    const url = `${API}/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(FIELDS)}&supportsAllDrives=true`;
    const res = await this.call(url, { method: 'GET' }, 'DRIVE_002');
    return (await res.json()) as DriveFile;
  }

  /** 파일을 내려받는다. 크기 제한을 먼저 확인한다 (PRD 13장). */
  async download(fileId: string): Promise<{ file: DriveFile; bytes: Uint8Array }> {
    const file = await this.getMetadata(fileId);
    if (file.trashed) throw new AppError('DRIVE_002', '휴지통에 있는 파일');
    if (file.size && Number(file.size) > LIMITS.maxFileBytes) throw new AppError('DOC_003', `${file.size} bytes`);
    const url = `${API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`;
    const res = await this.call(url, { method: 'GET' }, 'DRIVE_002');
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > LIMITS.maxFileBytes) throw new AppError('DOC_003', `${bytes.length} bytes`);
    return { file, bytes };
  }

  /** 새 파일 만들기 (Save As / 새 문서 첫 저장) */
  async create(params: { name: string; mimeType: string; bytes: Uint8Array; parentId?: string }): Promise<DriveFile> {
    const boundary = `school-hwp-${crypto.randomUUID()}`;
    const metadata: Record<string, unknown> = { name: params.name, mimeType: params.mimeType };
    if (params.parentId) metadata.parents = [params.parentId];
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${params.mimeType}\r\n\r\n`,
      params.bytes as BlobPart,
      `\r\n--${boundary}--`,
    ]);
    const url = `${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=${encodeURIComponent(FIELDS)}`;
    const res = await this.call(
      url,
      { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
      'SAVE_003',
    );
    return (await res.json()) as DriveFile;
  }

  /**
   * 기존 파일 내용 갱신 (FR-DRIVE-004: 파일 ID 유지).
   * 호출 전에 반드시 검증을 통과한 바이트만 넘긴다 (FR-SAVE-006).
   * 연 시점 이후 다른 곳에서 바뀌었으면 SAVE_004 를 던지고 덮어쓰지 않는다 (FR-SAVE-007).
   * Drive 는 바이너리 파일 갱신 시 이전 리비전을 보관한다 (FR-SAVE-008).
   */
  async update(
    snapshot: DriveSnapshot,
    params: { bytes: Uint8Array; mimeType: string },
    options: { force?: boolean } = {},
  ): Promise<DriveFile> {
    const current = await this.getMetadata(snapshot.fileId);
    if (current.trashed) throw new AppError('SAVE_003', '휴지통에 있는 파일');
    if (current.capabilities?.canEdit === false) throw new AppError('DRIVE_003', '편집 권한 없음');
    if (!options.force && hasChangedSince(snapshot, current)) {
      throw new AppError('SAVE_004', `${snapshot.headRevisionId ?? snapshot.modifiedTime} → ${current.headRevisionId ?? current.modifiedTime}`);
    }
    const url = `${UPLOAD}/files/${encodeURIComponent(snapshot.fileId)}?uploadType=media&supportsAllDrives=true&fields=${encodeURIComponent(FIELDS)}`;
    const res = await this.call(
      url,
      { method: 'PATCH', headers: { 'Content-Type': params.mimeType }, body: params.bytes as BodyInit },
      'SAVE_003',
    );
    return (await res.json()) as DriveFile;
  }
}
