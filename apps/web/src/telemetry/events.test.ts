import { describe, expect, it } from 'vitest';
import { buildEvent, platformInfo, sizeBucket } from './events';

const CROS_UA =
  'Mozilla/5.0 (X11; CrOS x86_64 16181.61.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

describe('events (PRD 11.4)', () => {
  it('ChromeOS 와 Chrome 버전을 뽑는다', () => {
    expect(platformInfo(CROS_UA)).toEqual({ browserVersion: '141.0.0.0', chromeOsVersion: '16181.61.0' });
  });

  it('파일 크기는 구간으로만 보낸다', () => {
    expect(sizeBucket(500_000)).toBe('<1MB');
    expect(sizeBucket(5 * 1024 * 1024)).toBe('1-10MB');
    expect(sizeBucket(30 * 1024 * 1024)).toBe('10-50MB');
  });

  it('이벤트에는 허용된 필드만 들어간다 (SEC-006)', () => {
    const e = buildEvent('save_failed', { errorCode: 'SAVE_002', format: 'hwpx' }, CROS_UA);
    const allowed = new Set([
      'type', 'timestamp', 'appVersion', 'rhwpVersion', 'browserVersion', 'chromeOsVersion',
      'errorCode', 'format', 'sizeBucket', 'durationMs', 'destination',
    ]);
    for (const key of Object.keys(e)) expect(allowed.has(key)).toBe(true);
    expect(JSON.stringify(e)).not.toMatch(/fileName|content|title|email/i);
  });
});
