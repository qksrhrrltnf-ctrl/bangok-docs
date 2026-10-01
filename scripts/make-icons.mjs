#!/usr/bin/env node
/**
 * PWA 아이콘 생성. 외부 도구 없이 PNG 를 직접 그린다.
 * 디자인: 남색 배경 + 흰 문서(접힌 모서리) + 줄 3개. HWP/한컴 상표는 쓰지 않는다 (PRD 8.3).
 * 학교 CI 이미지가 준비되면 apps/web/public/icons/ 의 파일을 교체하면 된다.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'apps', 'web', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

const NAVY = [0x1f, 0x4e, 0x8c, 255];
const WHITE = [255, 255, 255, 255];
const FOLD = [0xc9, 0xd6, 0xea, 255];
const CLEAR = [0, 0, 0, 0];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const p = pixel(x + 0.5, y + 0.5);
      raw.set(p, y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** u, v 는 0..1 정규 좌표. scale 은 문서 그림이 차지하는 비율(maskable 은 안전 영역 안). */
function glyph(u, v, scale) {
  const m = (1 - scale) / 2;
  const x = (u - m) / scale;
  const y = (v - m) / scale;
  // 문서: (0.22,0.12)-(0.78,0.88), 오른쪽 위 모서리 접힘
  const L = 0.22, R = 0.78, T = 0.12, B = 0.88, F = 0.16;
  if (x < L || x > R || y < T || y > B) return null;
  if (x > R - F && y < T + F) {
    // 접힌 삼각형
    if (x - (R - F) <= y - T) return FOLD;
    return 'bg';
  }
  // 줄
  const lineX0 = 0.32, lineX1 = 0.68, h = 0.045;
  for (const [ly, lx1] of [[0.42, lineX1], [0.55, lineX1], [0.68, 0.56]]) {
    if (y >= ly && y <= ly + h && x >= lineX0 && x <= lx1) return NAVY;
  }
  return WHITE;
}

function icon(size, maskable) {
  return png(size, (px, py) => {
    const u = px / size;
    const v = py / size;
    const inBg = maskable ? true : inRoundRect(u, v, 0.02, 0.02, 0.98, 0.98, 0.2);
    if (!inBg) return CLEAR;
    const g = glyph(u, v, maskable ? 0.62 : 0.8);
    if (g === null || g === 'bg') return NAVY;
    return g;
  });
}

for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-512-maskable.png', 512, true],
]) {
  writeFileSync(join(OUT, name), icon(size, maskable));
  console.log(`[icons] ${name}`);
}
