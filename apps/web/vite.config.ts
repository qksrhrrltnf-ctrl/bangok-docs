/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const rhwpVersion: string = pkg.dependencies['@rhwp/core'];
const brand = JSON.parse(readFileSync(new URL('./src/branding.json', import.meta.url), 'utf8'));

/** index.html 의 %APP_NAME% 등을 branding.json 값으로 바꾼다. */
function brandingHtml(): Plugin {
  const escape = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  return {
    name: 'school-hwp:branding-html',
    transformIndexHtml(html) {
      return html
        .replaceAll('%APP_NAME%', escape(brand.appName))
        .replaceAll('%APP_DESCRIPTION%', escape(brand.appDescription))
        .replaceAll('%APP_AUTHOR%', escape(`${brand.schoolName} ${brand.developer}`));
    },
  };
}

/**
 * @rhwp/core 의 JS 글루 코드는 init() 인자가 없을 때를 대비해
 * `new URL('rhwp_bg.wasm', import.meta.url)` 을 갖고 있다. Vite 는 이 패턴을 보고
 * 10MB WASM 을 한 벌 더 번들에 넣는다. 우리는 항상 편집기(/studio/)의 WASM 경로를
 * 명시적으로 넘기므로 이 기본 경로를 제거해 중복 다운로드를 막는다.
 */
function stripRhwpDefaultWasmUrl(): Plugin {
  return {
    name: 'school-hwp:strip-rhwp-default-wasm-url',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]@rhwp[\\/]core[\\/]rhwp\.js$/.test(id)) return null;
      const target = "new URL('rhwp_bg.wasm', import.meta.url)";
      if (!code.includes(target)) {
        this.warn('rhwp.js 의 기본 WASM 경로 패턴을 찾지 못했습니다. rHWP 업데이트 후 확인이 필요합니다.');
        return null;
      }
      return code.replace(target, "(() => { throw new Error('rhwp WASM 경로를 명시해야 합니다'); })()");
    },
  };
}

function productionHeaders(): Record<string, string> {
  const firebase = JSON.parse(readFileSync(new URL('../../firebase.json', import.meta.url), 'utf8'));
  const all = firebase.hosting.headers.find((h: { source: string }) => h.source === '**');
  return Object.fromEntries(all.headers.map((h: { key: string; value: string }) => [h.key, h.value]));
}

export default defineConfig(({ mode }) => ({
  // e2e 모드 빌드는 배포 대상(dist)과 섞이지 않도록 dist-e2e 에 만든다.
  build: { outDir: mode === 'e2e' ? 'dist-e2e' : 'dist' },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __RHWP_VERSION__: JSON.stringify(rhwpVersion),
  },
  plugins: [
    stripRhwpDefaultWasmUrl(),
    brandingHtml(),
    react(),
    VitePWA({
      // 새 버전은 백그라운드에서 받고, 다음 실행 때 적용한다 (FR-OFFLINE-004).
      // autoUpdate 는 편집 중 화면을 새로고침할 수 있으므로 쓰지 않는다.
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: brand.appName,
        short_name: brand.appShortName,
        description: brand.appDescription,
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#1f4e8c',
        background_color: '#ffffff',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 앱 셸 + 편집기(rhwp-studio) + 문서 엔진 WASM 을 설치 시 미리 캐시한다 (FR-OFFLINE-001).
        // CanvasKit WASM(선택 렌더러)은 기본 경로가 아니므로 제외한다.
        globPatterns: ['**/*.{js,css,html,png,svg,ico,json,woff,woff2}', 'studio/assets/rhwp_bg-*.wasm'],
        // config.json 은 기능 플래그(점검 모드 등)라 사전 캐시하지 않고 네트워크 우선으로 받는다.
        globIgnores: ['**/canvaskit-*.wasm', 'studio/rhwp.js', 'studio/print.html', 'config.json'],
        // 편집기 주소의 ?chrome=embed&renderer=... 를 무시해야 오프라인에서도 캐시와 일치한다.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^chrome$/, /^renderer$/],
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/studio\//, /^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/config.json',
            handler: 'NetworkFirst',
            options: { cacheName: 'app-config', networkTimeoutSeconds: 3 },
          },
          {
            // 편집기가 대체 글꼴로 쓰는 공개 웹폰트 (docs/fonts.md)
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*\.(woff2?|ttf|otf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'webfonts',
              expiration: { maxEntries: 60, maxAgeSeconds: 180 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/studio\/assets\/canvaskit-.*\.wasm$/,
            handler: 'CacheFirst',
            options: { cacheName: 'canvaskit', expiration: { maxEntries: 2 } },
          },
        ],
      },
    }),
  ],
  worker: {
    format: 'es',
    plugins: () => [stripRhwpDefaultWasmUrl()],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  // 미리보기 서버는 운영(Firebase Hosting)과 같은 보안 헤더를 쓴다. 단일 출처: 저장소 루트의 firebase.json
  preview: {
    port: 4273,
    strictPort: true,
    headers: productionHeaders(),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
