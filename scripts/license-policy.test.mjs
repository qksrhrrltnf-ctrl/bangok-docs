import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isBlocked } from './license-policy.mjs';

describe('라이선스 정책 (docs/legal-review.md 2절)', () => {
  it('허용형 라이선스는 통과', () => {
    for (const l of ['MIT', 'Apache-2.0', 'MIT OR Apache-2.0', 'BSD-3-Clause', 'ISC', 'Zlib', '(MIT OR Apache-2.0) AND Unicode-3.0', 'MIT/Apache-2.0', 'CC0-1.0']) {
      assert.equal(isBlocked(l), false, l);
    }
  });

  it('허용형 선택지가 있으면 카피레프트가 섞여도 통과 (허용형을 선택)', () => {
    assert.equal(isBlocked('MIT OR Apache-2.0 OR LGPL-2.1-or-later'), false);
    assert.equal(isBlocked('GPL-2.0 OR MIT'), false);
  });

  it('카피레프트·비상업만 있으면 차단', () => {
    for (const l of ['GPL-3.0', 'AGPL-3.0-only', 'LGPL-2.1', 'GPL-2.0 OR GPL-3.0', 'MIT AND GPL-3.0', 'CC-BY-NC-4.0', 'SSPL-1.0']) {
      assert.equal(isBlocked(l), true, l);
    }
  });

  it('표기가 없으면 차단하지 않고 고지 파일에 표기 없음으로 남긴다', () => {
    assert.equal(isBlocked(null), false);
  });
});
