import { driveConfigured } from '../env';
import { getDriveAccessToken, invalidateDriveToken } from '../google/driveToken';
import { DriveClient } from './driveClient';

let client: DriveClient | null = null;

/** Drive 가 설정되지 않았거나 기능 플래그로 꺼져 있으면 null */
export function getDriveClient(enabledByFlag: boolean): DriveClient | null {
  if (!driveConfigured || !enabledByFlag) return null;
  client ??= new DriveClient({
    fetch: (...args) => fetch(...args),
    getToken: getDriveAccessToken,
    onUnauthorized: invalidateDriveToken,
    isOnline: () => navigator.onLine,
  });
  return client;
}
