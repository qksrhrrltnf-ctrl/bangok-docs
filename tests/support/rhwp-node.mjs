/**
 * Node 에서 @rhwp/core 를 쓰기 위한 도우미 (테스트 전용).
 * 브라우저의 캔버스 텍스트 측정 대신 근사 폭 함수를 쓰므로 쪽 나눔은 브라우저와 다를 수 있다.
 * 텍스트·구조 round-trip 검사에는 충분하다.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const coreDir = dirname(require.resolve('@rhwp/core/package.json', { paths: [join(process.cwd(), 'apps', 'web'), process.cwd()] }));

globalThis.measureTextWidth ??= (font, text) => {
  const m = /(\d+(?:\.\d+)?)px/.exec(font);
  const px = m ? Number(m[1]) : 16;
  let w = 0;
  for (const ch of text) w += ch.codePointAt(0) > 0x2e80 ? px : px * 0.55;
  return w;
};

const core = await import(pathToFileURL(join(coreDir, 'rhwp.js')).href);
core.initSync({ module: readFileSync(join(coreDir, 'rhwp_bg.wasm')) });

export const { HwpDocument, version } = core;

export function openDocument(bytes) {
  return new HwpDocument(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
}

/** 모든 쪽의 글자를 모은다. getPageText 는 표 셀을 빼므로 레이아웃 텍스트(runs)를 쓴다. */
export function allText(doc) {
  const out = [];
  for (let i = 0; i < doc.pageCount(); i++) {
    try {
      const layout = JSON.parse(doc.getPageTextLayout(i));
      out.push((layout.runs ?? []).map((r) => r.text).join(' '));
    } catch {
      out.push(String(doc.getPageText(i)));
    }
  }
  return out.join('\n');
}

export function normalizeText(text) {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}
