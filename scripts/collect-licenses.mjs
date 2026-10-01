#!/usr/bin/env node
/**
 * 제3자 라이선스 고지 수집 (docs/legal-review.md).
 *
 * MIT·BSD·Apache 라이선스는 소프트웨어를 배포할 때 저작권 고지와 라이선스 문구를 함께 전달하라고 요구한다.
 * 이 앱은 학생 브라우저로 다음 코드를 배포하므로, 그 원문을 모아 /licenses/ 로 함께 배포한다.
 *
 *   1. rHWP (MIT) 와 rHWP 가 직접 정리한 제3자 고지 (THIRD_PARTY_LICENSES.md)
 *   2. rHWP WASM 에 컴파일된 Rust 크레이트 (Cargo.lock 의존성 그래프, 상위 집합)
 *   3. 앱 번들에 들어가는 npm 패키지 (apps/web 운영 의존성 + Workbox 런타임)
 *   4. 편집기(rhwp-studio) 번들에 들어가는 npm 패키지
 *
 * 카피레프트(GPL/AGPL/LGPL 등)나 비상업 조건 라이선스가 발견되면 실패한다.
 * scripts/build-studio.mjs 가 마지막 단계로 실행한다. 단독 실행: node scripts/collect-licenses.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { isBlocked } from './license-policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'apps', 'web');
const OUT = join(WEB, 'public', 'licenses');
const isWin = process.platform === 'win32';

const webPkg = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8'));
const brand = JSON.parse(readFileSync(join(WEB, 'src', 'branding.json'), 'utf8'));
const version = webPkg.dependencies['@rhwp/core'];
const cacheBase = process.env.SCHOOL_HWP_BUILD_DIR
  || (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'school-hwp-build') : join(homedir(), '.cache', 'school-hwp-build'));
const RHWP = join(cacheBase, `rhwp-v${version}`);
const CRATE_CACHE = join(cacheBase, 'crate-licenses');

const LICENSE_FILE = /^(licen[cs]e|copying|notice|copyright|unlicense|authors?)(\b|[-_.].*)?$/i;

const components = [];

function log(msg) {
  console.log(`[licenses] ${msg}`);
}
function fail(msg) {
  console.error(`[licenses] 오류: ${msg}`);
  process.exit(1);
}

function add(entry) {
  if (isBlocked(entry.license)) {
    fail(`허용하지 않는 라이선스: ${entry.ecosystem} ${entry.name}@${entry.version} (${entry.license})`);
  }
  components.push(entry);
}

// ── 1. rHWP ──────────────────────────────────────────────────────────
if (!existsSync(join(RHWP, 'LICENSE'))) fail(`rHWP 원본이 없습니다: ${RHWP} (npm run build:studio 먼저)`);
const rhwpLicense = readFileSync(join(RHWP, 'LICENSE'), 'utf8');
const rhwpThirdParty = readFileSync(join(RHWP, 'THIRD_PARTY_LICENSES.md'), 'utf8');
add({ ecosystem: 'rhwp', name: 'rHWP (@rhwp/core, @rhwp/editor, rhwp-studio)', version, license: 'MIT', texts: [rhwpLicense] });

// ── 2. Rust 크레이트 (Cargo.lock 그래프) ────────────────────────────────
function parseCargoLock(text) {
  const pkgs = [];
  for (const block of text.split(/\n\[\[package\]\]\n/).slice(1)) {
    const get = (k) => new RegExp(`^${k} = "(.*)"$`, 'm').exec(block)?.[1];
    const deps = /^dependencies = \[\n([\s\S]*?)\n\]/m.exec(block)?.[1]
      ?.split('\n')
      .map((l) => l.trim().replace(/^"|",?$/g, ''))
      .filter(Boolean) ?? [];
    pkgs.push({ name: get('name'), version: get('version'), source: get('source'), deps });
  }
  return pkgs;
}

function reachableCrates(pkgs, rootName) {
  const byName = new Map();
  for (const p of pkgs) byName.set(p.name, [...(byName.get(p.name) ?? []), p]);
  const resolveDep = (d) => {
    const [name, ver] = d.split(' ');
    const cands = byName.get(name) ?? [];
    return ver ? cands.find((c) => c.version === ver) : cands[0];
  };
  const seen = new Set();
  const out = [];
  const stack = [...(byName.get(rootName) ?? [])];
  while (stack.length) {
    const p = stack.pop();
    const key = `${p.name}@${p.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    for (const d of p.deps) {
      const r = resolveDep(d);
      if (r) stack.push(r);
    }
  }
  return out;
}

/** .crate (tar.gz) 에서 최상위 라이선스 파일과 Cargo.toml 을 꺼낸다 */
function extractCrate(buf) {
  const tar = gunzipSync(buf);
  const files = {};
  let off = 0;
  let longName = null;
  while (off + 512 <= tar.length) {
    const header = tar.subarray(off, off + 512);
    if (header.every((b) => b === 0)) break;
    const str = (s, e) => header.subarray(s, e).toString('utf8').replace(/\0.*$/s, '');
    let name = str(0, 100);
    const prefix = str(345, 500);
    if (prefix) name = `${prefix}/${name}`;
    const size = parseInt(str(124, 136).trim() || '0', 8);
    const type = String.fromCharCode(header[156] || 48);
    const body = tar.subarray(off + 512, off + 512 + size);
    if (type === 'L') longName = body.toString('utf8').replace(/\0.*$/s, '');
    else if (type === 'x') {
      const m = /\d+ path=([^\n]+)\n/.exec(body.toString('utf8'));
      if (m) longName = m[1];
    } else {
      if (longName) {
        name = longName;
        longName = null;
      }
      const parts = name.split('/');
      if (type === '0' || type === '\0') {
        if (parts.length === 2 && (LICENSE_FILE.test(parts[1]) || parts[1] === 'Cargo.toml')) {
          files[parts[1]] = body.toString('utf8');
        }
      }
    }
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

async function crateLicense(p) {
  mkdirSync(CRATE_CACHE, { recursive: true });
  const cacheFile = join(CRATE_CACHE, `${p.name}-${p.version}.json`);
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8'));
  const res = await fetch(`https://static.crates.io/crates/${p.name}/${p.name}-${p.version}.crate`);
  if (!res.ok) throw new Error(`crates.io ${p.name}@${p.version}: HTTP ${res.status}`);
  const files = extractCrate(Buffer.from(await res.arrayBuffer()));
  const toml = files['Cargo.toml'] ?? '';
  const license = /^license\s*=\s*"([^"]+)"/m.exec(toml)?.[1] ?? null;
  const authors = /^authors\s*=\s*\[([^\]]*)\]/m.exec(toml)?.[1]?.match(/"([^"]+)"/g)?.map((s) => s.slice(1, -1)) ?? [];
  const texts = Object.entries(files)
    .filter(([n]) => n !== 'Cargo.toml')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, t]) => t);
  const result = { license, authors, texts };
  writeFileSync(cacheFile, JSON.stringify(result));
  return result;
}

const lockPath = join(RHWP, 'Cargo.lock');
if (!existsSync(lockPath)) fail('rHWP Cargo.lock 이 없습니다');
const lockText = readFileSync(lockPath, 'utf8').split('\r\n').join('\n');
const crates = reachableCrates(parseCargoLock(lockText), 'rhwp').filter((p) => p.source?.startsWith('registry+'));
log(`Rust 크레이트 ${crates.length}개 확인 중 (첫 실행은 crates.io 에서 내려받아 캐시)`);
const queue = [...crates];
const crateResults = new Map();
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const p = queue.shift();
      crateResults.set(p, await crateLicense(p));
    }
  }),
);
for (const p of crates) {
  const r = crateResults.get(p);
  add({
    ecosystem: 'cargo',
    name: p.name,
    version: p.version,
    license: r.license,
    authors: r.authors,
    texts: r.texts,
  });
}

// ── 3·4. npm 패키지 ──────────────────────────────────────────────────
function npmLicenseTexts(dir) {
  return readdirSync(dir)
    .filter((f) => LICENSE_FILE.test(f) && statSync(join(dir, f)).isFile())
    .sort()
    .map((f) => readFileSync(join(dir, f), 'utf8'));
}

function licenseField(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license?.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type ?? l).join(' OR ');
  return null;
}

function addNpmTree(nodeModulesRoot, names, label) {
  const seen = new Set();
  const stack = [...names];
  while (stack.length) {
    const name = stack.pop();
    if (seen.has(name)) continue;
    seen.add(name);
    const dir = join(nodeModulesRoot, name);
    if (!existsSync(join(dir, 'package.json'))) fail(`${label}: ${name} 패키지를 찾을 수 없습니다`);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    add({ ecosystem: `npm (${label})`, name, version: pkg.version, license: licenseField(pkg), authors: pkg.author ? [typeof pkg.author === 'string' ? pkg.author : pkg.author.name] : [], texts: npmLicenseTexts(dir) });
    for (const dep of Object.keys(pkg.dependencies ?? {})) stack.push(dep);
  }
}

// 앱 번들: apps/web 운영 의존성 + vite-plugin-pwa 가 번들에 넣는 Workbox 런타임
const workboxRuntime = ['workbox-window', 'workbox-core', 'workbox-precaching', 'workbox-routing', 'workbox-strategies', 'workbox-expiration', 'workbox-cacheable-response'];
addNpmTree(join(ROOT, 'node_modules'), [...Object.keys(webPkg.dependencies), ...workboxRuntime], '앱');

// 편집기 번들: rhwp-studio 의 운영 의존성 중 소스에서 실제로 import 하는 것
const studioPkg = JSON.parse(readFileSync(join(RHWP, 'rhwp-studio', 'package.json'), 'utf8'));
const studioSrc = execFileSync(isWin ? 'findstr' : 'grep', isWin ? ['/s', '/m', '/c:from \'', '*.ts'] : ['-rl', "from '", '.'], {
  cwd: join(RHWP, 'rhwp-studio', 'src'),
  encoding: 'utf8',
}).split(/\r?\n/).filter(Boolean);
const importedStudioDeps = Object.keys(studioPkg.dependencies ?? {}).filter((dep) =>
  studioSrc.some((f) => readFileSync(join(RHWP, 'rhwp-studio', 'src', f), 'utf8').includes(`'${dep}`)),
);
addNpmTree(join(RHWP, 'rhwp-studio', 'node_modules'), importedStudioDeps, '편집기');

// ── 출력 ────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });

const header = [
  `${brand.appName} — 제3자 소프트웨어 고지`,
  '='.repeat(60),
  '',
  `이 서비스는 ${brand.schoolName}가 운영하며, 아래 오픈소스 소프트웨어를 포함합니다.`,
  '각 구성 요소는 해당 라이선스에 따라 사용·배포되며, 저작권은 각 저작권자에게 있습니다.',
  '',
  '본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.',
  '"한글", "한컴", "HWP", "HWPX"는 주식회사 한글과컴퓨터의 등록 상표입니다.',
  `${brand.appName}는 한글과컴퓨터와 제휴, 후원, 승인 관계가 없습니다.`,
  '',
  `생성: ${new Date().toISOString()} · rHWP ${version} · 구성 요소 ${components.length}개`,
  '',
];

// 같은 원문을 쓰는 구성 요소를 묶어 중복을 줄인다
const groups = new Map();
const noText = [];
for (const c of components) {
  if (c.texts.length === 0) {
    noText.push(c);
    continue;
  }
  const key = c.texts.map((t) => t.replace(/\r\n/g, '\n').trim()).join('\n\n-----\n\n');
  groups.set(key, [...(groups.get(key) ?? []), c]);
}

const body = [];
body.push('#'.repeat(60), '# rHWP 가 정리한 제3자 고지 (THIRD_PARTY_LICENSES.md 원문)', '#'.repeat(60), '', rhwpThirdParty.trim(), '');
for (const [text, members] of groups) {
  body.push('#'.repeat(60));
  for (const m of members) body.push(`# ${m.ecosystem}: ${m.name}@${m.version} (${m.license ?? '라이선스 표기 없음'})`);
  body.push('#'.repeat(60), '', text, '');
}
if (noText.length) {
  body.push('#'.repeat(60), '# 라이선스 원문 파일을 포함하지 않은 구성 요소 (패키지 메타데이터의 SPDX 표기를 따름)', '#'.repeat(60), '');
  for (const m of noText) {
    body.push(`- ${m.ecosystem}: ${m.name}@${m.version} — ${m.license ?? '표기 없음'}${m.authors?.length ? ` — ${m.authors.join(', ')}` : ''}`);
  }
  body.push('', '위 구성 요소가 따르는 표준 라이선스 원문은 아래 부록에 있다. 전체 목록: https://spdx.org/licenses/', '');

  // 부록: 다른 구성 요소가 동봉한 표준 원문을 재사용한다 (MIT 는 표준 문안)
  const allTexts = components.flatMap((c) => c.texts);
  const apache = allTexts.find((t) => /Apache License\s+Version 2\.0, January 2004/.test(t) && t.length > 9000);
  const zlib = allTexts.find((t) => /provided 'as-is', without any express or implied/.test(t));
  const mit = [
    'MIT License',
    '',
    'Copyright (c) <해당 구성 요소의 저작권자 — 위 목록의 저자 표기>',
    '',
    'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:',
    '',
    'The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.',
    '',
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
  ].join('\n');
  body.push('#'.repeat(60), '# 부록 A. MIT License (표준 문안)', '#'.repeat(60), '', mit, '');
  if (apache) body.push('#'.repeat(60), '# 부록 B. Apache License 2.0', '#'.repeat(60), '', apache.trim(), '');
  else fail('Apache-2.0 원문을 찾지 못했습니다');
  if (zlib) body.push('#'.repeat(60), '# 부록 C. zlib License', '#'.repeat(60), '', zlib.trim(), '');
}

writeFileSync(join(OUT, 'THIRD_PARTY_NOTICES.txt'), [...header, ...body].join('\n'));
writeFileSync(join(OUT, 'rhwp-LICENSE.txt'), rhwpLicense);
writeFileSync(
  join(OUT, 'licenses.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      rhwpVersion: version,
      components: components.map(({ ecosystem, name, version: v, license, texts }) => ({ ecosystem, name, version: v, license, hasText: texts.length > 0 })),
    },
    null,
    1,
  ),
);

const summary = {};
for (const c of components) summary[c.license ?? '표기 없음'] = (summary[c.license ?? '표기 없음'] ?? 0) + 1;
log(`구성 요소 ${components.length}개, 원문 없는 항목 ${noText.length}개`);
log(`라이선스 분포: ${Object.entries(summary).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', ')}`);
log(`출력: ${OUT}`);
