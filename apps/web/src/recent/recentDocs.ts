/**
 * 최근 문서 목록. 이 기기의 브라우저에만 파일 이름과 Drive 파일 ID 를 둔다.
 * 문서 내용은 저장하지 않는다. 다시 열 수 있는 Drive 문서만 기록한다.
 */

export interface RecentDoc {
  driveFileId: string;
  name: string;
  openedAt: number;
}

const MAX = 12;
const key = (userSub: string) => `school-hwp:recent:${userSub}`;

export function listRecent(userSub: string): RecentDoc[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(userSub)) ?? '[]') as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (r): r is RecentDoc =>
        r && typeof r.driveFileId === 'string' && typeof r.name === 'string' && typeof r.openedAt === 'number',
    );
  } catch {
    return [];
  }
}

export function addRecent(userSub: string, doc: Omit<RecentDoc, 'openedAt'>, now = Date.now()): RecentDoc[] {
  const next = [
    { ...doc, openedAt: now },
    ...listRecent(userSub).filter((r) => r.driveFileId !== doc.driveFileId),
  ].slice(0, MAX);
  try {
    localStorage.setItem(key(userSub), JSON.stringify(next));
  } catch {
    // 저장 공간 부족은 무시
  }
  return next;
}

export function removeRecent(userSub: string, driveFileId: string): void {
  try {
    localStorage.setItem(key(userSub), JSON.stringify(listRecent(userSub).filter((r) => r.driveFileId !== driveFileId)));
  } catch {
    // 무시
  }
}

export function clearRecent(userSub: string): void {
  try {
    localStorage.removeItem(key(userSub));
  } catch {
    // 무시
  }
}
