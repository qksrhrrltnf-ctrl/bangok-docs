#!/usr/bin/env node
/**
 * GitHub Pages 배포 준비 (docs/deployment.md "GitHub Pages").
 *
 * GitHub Pages 는 응답 헤더를 지정할 수 없다. 그래서 firebase.json 의 보안 정책(CSP)을
 * 앱과 편집기 index.html 에 <meta http-equiv> 로 넣는다. meta 로는 동작하지 않는
 * frame-ancestors 는 뺀다. 그래서 GitHub Pages 에서는 다른 사이트가 편집기를 iframe 으로
 * 품는 것을 막지 못한다 (알려진 제약, docs/security.md).
 *
 * 또 Jekyll 처리를 끄는 .nojekyll 을 만든다 (밑줄로 시작하는 파일 보호).
 *
 * 사용: node scripts/prepare-pages.mjs [dist 폴더]   (기본 apps/web/dist)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(process.argv[2] ?? join(ROOT, 'apps', 'web', 'dist'));

const firebase = JSON.parse(readFileSync(join(ROOT, 'firebase.json'), 'utf8'));
const all = firebase.hosting.headers.find((h) => h.source === '**');
const csp = all.headers.find((h) => h.key === 'Content-Security-Policy').value;
const metaCsp = csp
  .split(';')
  .map((d) => d.trim())
  .filter((d) => d && !d.startsWith('frame-ancestors'))
  .join('; ');
const referrer = all.headers.find((h) => h.key === 'Referrer-Policy')?.value ?? 'strict-origin-when-cross-origin';

const metas = [
  `<meta http-equiv="Content-Security-Policy" content="${metaCsp}">`,
  `<meta name="referrer" content="${referrer}">`,
].join('\n    ');

for (const rel of ['index.html', 'studio/index.html']) {
  const file = join(DIST, rel);
  if (!existsSync(file)) {
    console.error(`[pages] 오류: ${file} 이 없습니다. 빌드를 먼저 하세요.`);
    process.exit(1);
  }
  let html = readFileSync(file, 'utf8');
  if (html.includes('http-equiv="Content-Security-Policy"')) continue;
  // CSP 는 다른 어떤 리소스보다 먼저 와야 하므로 <head> 바로 뒤, charset 다음에 넣는다.
  html = /<meta charset="[^"]*"\s*\/?>/i.test(html)
    ? html.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1\n    ${metas}`)
    : html.replace(/<head>/i, `<head>\n    ${metas}`);
  writeFileSync(file, html);
  console.log(`[pages] CSP 메타 태그 추가: ${rel}`);
}

writeFileSync(join(DIST, '.nojekyll'), '');
console.log(`[pages] 준비 완료: ${DIST}`);
