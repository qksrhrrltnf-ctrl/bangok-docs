import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../errors';
import { DriveClient, hasChangedSince, type DriveFile } from './driveClient';

const meta: DriveFile = {
  id: 'file-1',
  name: '과제.hwpx',
  mimeType: 'application/hwp+zip',
  size: '1000',
  modifiedTime: '2026-09-29T01:00:00Z',
  headRevisionId: 'rev-1',
  capabilities: { canEdit: true },
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function client(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => handler(String(url), init ?? {}));
  const onUnauthorized = vi.fn();
  const c = new DriveClient({
    fetch: fetchMock as unknown as typeof fetch,
    getToken: async () => 'token',
    onUnauthorized,
    isOnline: () => true,
  });
  return { c, fetchMock, onUnauthorized };
}

async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (err) {
    return err instanceof AppError ? err.code : 'NOT_APP_ERROR';
  }
  return undefined;
}

describe('hasChangedSince (FR-SAVE-007)', () => {
  it('리비전 ID 가 같으면 변경 없음', () => {
    expect(hasChangedSince({ fileId: 'f', name: 'n', headRevisionId: 'r1' }, { ...meta, headRevisionId: 'r1' })).toBe(false);
  });
  it('리비전 ID 가 다르면 변경', () => {
    expect(hasChangedSince({ fileId: 'f', name: 'n', headRevisionId: 'r1' }, { ...meta, headRevisionId: 'r2' })).toBe(true);
  });
  it('리비전 ID 가 없으면 수정 시각으로 비교', () => {
    const snap = { fileId: 'f', name: 'n', modifiedTime: 't1' };
    expect(hasChangedSince(snap, { ...meta, headRevisionId: undefined, modifiedTime: 't1' })).toBe(false);
    expect(hasChangedSince(snap, { ...meta, headRevisionId: undefined, modifiedTime: 't2' })).toBe(true);
  });
  it('비교할 값이 없으면 안전하게 변경으로 본다', () => {
    expect(hasChangedSince({ fileId: 'f', name: 'n' }, { id: 'f', name: 'n', mimeType: 'x' })).toBe(true);
  });
});

describe('DriveClient', () => {
  it('download 는 메타데이터를 먼저 보고 내용을 받는다', async () => {
    const { c, fetchMock } = client((url) => (url.includes('alt=media') ? new Response(new Uint8Array([1, 2, 3])) : json(meta)));
    const r = await c.download('file-1');
    expect(r.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const auth = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(auth.Authorization).toBe('Bearer token');
  });

  it('너무 큰 파일은 내려받지 않는다 (DOC_003)', async () => {
    const { c, fetchMock } = client(() => json({ ...meta, size: String(60 * 1024 * 1024) }));
    expect(await codeOf(c.download('file-1'))).toBe('DOC_003');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('update 는 리비전이 같을 때만 PATCH 한다', async () => {
    const { c, fetchMock } = client((_url, init) =>
      init.method === 'PATCH' ? json({ ...meta, headRevisionId: 'rev-2' }) : json(meta),
    );
    const updated = await c.update({ fileId: 'file-1', name: '과제.hwpx', headRevisionId: 'rev-1' }, { bytes: new Uint8Array([9]), mimeType: 'application/hwp+zip' });
    expect(updated.headRevisionId).toBe('rev-2');
    const patch = fetchMock.mock.calls.find((call) => (call[1] as RequestInit).method === 'PATCH');
    expect(String(patch?.[0])).toContain('/upload/drive/v3/files/file-1?uploadType=media');
  });

  it('다른 곳에서 바뀌었으면 SAVE_004 이고 PATCH 하지 않는다', async () => {
    const { c, fetchMock } = client(() => json({ ...meta, headRevisionId: 'rev-9' }));
    const code = await codeOf(c.update({ fileId: 'file-1', name: 'x', headRevisionId: 'rev-1' }, { bytes: new Uint8Array([9]), mimeType: 'x' }));
    expect(code).toBe('SAVE_004');
    expect(fetchMock.mock.calls.some((call) => (call[1] as RequestInit).method === 'PATCH')).toBe(false);
  });

  it('force 이면 충돌이 있어도 덮어쓴다', async () => {
    const { c } = client((_url, init) => (init.method === 'PATCH' ? json({ ...meta, headRevisionId: 'rev-10' }) : json({ ...meta, headRevisionId: 'rev-9' })));
    const r = await c.update({ fileId: 'file-1', name: 'x', headRevisionId: 'rev-1' }, { bytes: new Uint8Array([9]), mimeType: 'x' }, { force: true });
    expect(r.headRevisionId).toBe('rev-10');
  });

  it('편집 권한이 없으면 DRIVE_003', async () => {
    const { c } = client(() => json({ ...meta, capabilities: { canEdit: false } }));
    expect(await codeOf(c.update({ fileId: 'file-1', name: 'x', headRevisionId: 'rev-1' }, { bytes: new Uint8Array(), mimeType: 'x' }))).toBe('DRIVE_003');
  });

  it('401 이면 토큰을 무효화하고 한 번 다시 시도한다', async () => {
    let first = true;
    const { c, onUnauthorized, fetchMock } = client(() => {
      if (first) {
        first = false;
        return json({ error: { message: 'expired' } }, 401);
      }
      return json(meta);
    });
    await c.getMetadata('file-1');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('create 는 multipart 로 이름과 형식을 보낸다', async () => {
    const { c, fetchMock } = client(() => json({ ...meta, id: 'new-1' }));
    const created = await c.create({ name: '보고서.hwpx', mimeType: 'application/hwp+zip', bytes: new Uint8Array([1]), parentId: 'folder-1' });
    expect(created.id).toBe('new-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('uploadType=multipart');
    const body = await new Response((init as RequestInit).body as Blob).text();
    expect(body).toContain('"name":"보고서.hwpx"');
    expect(body).toContain('"parents":["folder-1"]');
  });

  it('네트워크가 끊겼으면 SAVE_005', async () => {
    const c = new DriveClient({
      fetch: (async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch,
      getToken: async () => 't',
      isOnline: () => false,
    });
    expect(await codeOf(c.getMetadata('x'))).toBe('SAVE_005');
  });
});
