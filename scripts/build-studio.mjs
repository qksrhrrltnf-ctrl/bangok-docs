#!/usr/bin/env node
/**
 * rhwp-studio 자체 호스팅 빌드 스크립트.
 *
 * 왜 필요한가:
 *   @rhwp/editor 는 기본적으로 https://edwardkim.github.io/rhwp/ 의 편집기를 iframe 으로 불러온다.
 *   운영 환경에서 외부 사이트의 최신 코드를 그대로 쓰면 버전 고정(PRD 10.2)이 깨지고,
 *   편집기가 우리가 통제하지 않는 출처에서 실행된다. 그래서 고정된 태그의 rhwp-studio 를
 *   직접 빌드해 apps/web/public/studio/ 에 두고 같은 출처(/studio/)에서 제공한다.
 *
 * 하는 일:
 *   1. apps/web/package.json 의 @rhwp/core 고정 버전(예: 0.8.6)을 읽는다.
 *   2. rhwp 저장소의 v{버전} 태그에서 rhwp-studio 만 sparse clone 한다.
 *   3. npm 레지스트리의 @rhwp/core 같은 버전(= wasm-pack 산출물)을 pkg/ 에 넣는다.
 *      → Rust 툴체인 없이 빌드 가능.
 *   4. 편집기 자체 PWA(서비스 워커) 플러그인을 뺀 설정으로 base=/studio/ 빌드한다.
 *   5. 산출물을 apps/web/public/studio/ 로 복사하고 studio-manifest.json 을 쓴다.
 *
 * 빌드 작업 폴더는 구글 드라이브 동기화 폴더 밖(로컬 캐시)에 둔다.
 * 환경 변수 SCHOOL_HWP_BUILD_DIR 로 바꿀 수 있다.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'apps', 'web');
const OUT = join(WEB, 'public', 'studio');
const REPO = 'https://github.com/edwardkim/rhwp.git';

const webPkg = JSON.parse(readFileSync(join(WEB, 'package.json'), 'utf8'));
const version = webPkg.dependencies['@rhwp/core'];
const editorVersion = webPkg.dependencies['@rhwp/editor'];
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`@rhwp/core 는 정확한 버전으로 고정해야 합니다 (현재: ${version})`);
}
if (editorVersion !== version) {
  fail(`@rhwp/core(${version}) 와 @rhwp/editor(${editorVersion}) 버전이 같아야 합니다`);
}

const cacheBase = process.env.SCHOOL_HWP_BUILD_DIR
  || (process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'school-hwp-build') : join(homedir(), '.cache', 'school-hwp-build'));
const work = join(cacheBase, `rhwp-v${version}`);
const studio = join(work, 'rhwp-studio');
const isWin = process.platform === 'win32';

log(`rhwp 버전: ${version}`);
log(`작업 폴더: ${work}`);

// 1) sparse clone (이미 있으면 재사용)
if (!existsSync(join(studio, 'package.json'))) {
  rmSync(work, { recursive: true, force: true });
  mkdirSync(cacheBase, { recursive: true });
  run('git', ['clone', '--depth', '1', '--branch', `v${version}`, '--filter=blob:none', '--sparse', REPO, work], cacheBase);
  run('git', ['sparse-checkout', 'set', 'rhwp-studio'], work);
} else {
  log('기존 clone 재사용');
}

// 2) @rhwp/core 를 pkg/ 로 준비 (wasm-pack 산출물과 같은 구성)
const pkgDir = join(work, 'pkg');
const coreMarker = join(pkgDir, 'package.json');
const coreReady = existsSync(coreMarker) && JSON.parse(readFileSync(coreMarker, 'utf8')).version === version;
if (!coreReady) {
  rmSync(pkgDir, { recursive: true, force: true });
  const packDir = join(work, '.pack');
  rmSync(packDir, { recursive: true, force: true });
  mkdirSync(packDir, { recursive: true });
  run(npmCmd(), ['pack', `@rhwp/core@${version}`, '--pack-destination', packDir], packDir);
  const tgz = readdirSync(packDir).find((f) => f.endsWith('.tgz'));
  if (!tgz) fail('@rhwp/core 패키지를 내려받지 못했습니다');
  run('tar', ['-xzf', tgz], packDir);
  cpSync(join(packDir, 'package'), pkgDir, { recursive: true });
  rmSync(packDir, { recursive: true, force: true });
}

// 3) 의존성 설치
if (!existsSync(join(studio, 'node_modules', 'vite'))) {
  run(npmCmd(), ['ci', '--no-audit', '--no-fund', '--ignore-scripts'], studio);
}

// 4) 학교용 빌드 설정: 편집기 자체 PWA 제거 + base=/studio/
const schoolConfig = join(studio, 'vite.school.config.ts');
writeFileSync(schoolConfig, `// 자동 생성 파일 — scripts/build-studio.mjs
import original from './vite.config.ts';

const base = typeof original === 'function'
  ? await (original as any)({ command: 'build', mode: 'production' })
  : original;

const plugins = [base.plugins ?? []]
  .flat(Infinity)
  .filter((p: any) => p && !String(p.name ?? '').startsWith('vite-plugin-pwa'));

export default {
  ...base,
  base: '/studio/',
  plugins,
  build: { ...(base.build ?? {}), outDir: 'dist-school', emptyOutDir: true },
};
`);

run(npxCmd(), ['vite', 'build', '-c', 'vite.school.config.ts'], studio, {
  RHWP_WITHOUT_HWPCTRL: '1',
});

// 5) 산출물 복사
const dist = join(studio, 'dist-school');
if (!existsSync(join(dist, 'index.html'))) fail('편집기 빌드 산출물(index.html)이 없습니다');
rmSync(OUT, { recursive: true, force: true });
cpSync(dist, OUT, { recursive: true });
// rhwp 저장소의 예제 문서는 학교 앱에 필요 없고 배포 용량만 늘린다.
rmSync(join(OUT, 'samples'), { recursive: true, force: true });

// 학교 앱 검증 워커가 같은 WASM 파일을 재사용하도록 경로를 기록한다(중복 다운로드 방지).
const assets = readdirSync(join(OUT, 'assets'));
const wasm = assets.find((f) => /^rhwp_bg.*\.wasm$/.test(f));
if (!wasm) fail('편집기 산출물에서 rhwp_bg*.wasm 을 찾지 못했습니다');
writeFileSync(join(OUT, 'studio-manifest.json'), JSON.stringify({
  rhwpVersion: version,
  wasm: `assets/${wasm}`,
  builtAt: new Date().toISOString(),
}, null, 2));

log(`완료: ${OUT}`);

// 6) 제3자 라이선스 고지 생성 (MIT/BSD/Apache 고지 의무, docs/legal-review.md)
run(process.execPath, [join(ROOT, 'scripts', 'collect-licenses.mjs')], ROOT);

function run(cmd, args, cwd, extraEnv = {}) {
  log(`$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv }, shell: isWin && /\.cmd$/.test(cmd) });
}
function npmCmd() { return isWin ? 'npm.cmd' : 'npm'; }
function npxCmd() { return isWin ? 'npx.cmd' : 'npx'; }
function log(msg) { console.log(`[build-studio] ${msg}`); }
function fail(msg) { console.error(`[build-studio] 오류: ${msg}`); process.exit(1); }
