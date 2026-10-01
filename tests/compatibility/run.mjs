#!/usr/bin/env node
/**
 * Compatibility / Round-trip Test (PRD 16~17장).
 *
 *   원본 열기 → HWPX 저장 → 다시 열기 → 쪽 수·본문 텍스트 비교 → 한 번 더 저장해 결과가 안정적인지 비교
 *   (HWP 호환 저장 경로도 같은 방식으로 확인)
 *
 * 대상:
 *   tests/fixtures/synthetic/  합성 문서 (저장소에 포함)
 *   tests/fixtures/private/    익명화한 학교 문서 (커밋 금지, 있을 때만)
 *
 * 보고서에는 파일 내용과 본문을 넣지 않는다. private 문서는 파일 이름 대신 순번을 쓴다.
 * rHWP 를 올리거나 serializer 를 바꿀 때 반드시 실행한다 (CLAUDE.md 규칙 7, 8).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allText, normalizeText, openDocument, version } from '../support/rhwp-node.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'fixtures');
const REPORT_DIR = join(HERE, 'report');

const sources = [
  { dir: join(FIXTURES, 'synthetic'), private: false },
  { dir: join(FIXTURES, 'private'), private: true },
];

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

function roundTrip(doc, exportFn) {
  const bytes = exportFn(doc);
  const reopened = openDocument(bytes);
  try {
    return { bytes, pages: reopened.pageCount(), text: normalizeText(allText(reopened)), again: exportFn(reopened) };
  } finally {
    reopened.free();
  }
}

function lossCount(doc, format) {
  try {
    const report = format === 'hwpx' ? doc.exportHwpxWithReport() : doc.exportHwpWithReport();
    try {
      return JSON.parse(report.contentLoss()).count ?? 0;
    } finally {
      report.free();
    }
  } catch {
    return null;
  }
}

const results = [];
let privateIndex = 0;

for (const source of sources) {
  if (!existsSync(source.dir)) continue;
  for (const file of readdirSync(source.dir).filter((f) => /\.hwpx?$/i.test(f)).sort()) {
    const label = source.private ? `private-${String(++privateIndex).padStart(3, '0')}${file.slice(file.lastIndexOf('.'))}` : file;
    const result = { file: label, ok: false, checks: {} };
    const started = performance.now();
    let doc;
    try {
      doc = openDocument(readFileSync(join(source.dir, file)));
      const pages = doc.pageCount();
      const text = normalizeText(allText(doc));
      result.checks.open = pages > 0;
      result.pages = pages;
      result.textHash = sha(text);

      for (const format of ['hwpx', 'hwp']) {
        const exportFn = (d) => (format === 'hwpx' ? d.exportHwpx() : d.exportHwp());
        const rt = roundTrip(doc, exportFn);
        result.checks[`${format}Reopen`] = rt.pages > 0;
        result.checks[`${format}TextPreserved`] = rt.text === text;
        result.checks[`${format}PagesPreserved`] = rt.pages === pages;
        // 저장 → 열기 → 저장을 두 번 해도 텍스트가 같아야 한다 (serializer 안정성)
        const second = openDocument(rt.again);
        try {
          result.checks[`${format}Stable`] = normalizeText(allText(second)) === rt.text;
        } finally {
          second.free();
        }
        result[`${format}LossCount`] = lossCount(doc, format);
      }
      // HWPX 가 기본 형식이므로 HWPX 경로만 필수로 본다. HWP 호환 저장은 참고용 (PRD 15장).
      result.ok = ['open', 'hwpxReopen', 'hwpxTextPreserved', 'hwpxStable'].every((k) => result.checks[k]);
    } catch (err) {
      result.error = (err instanceof Error ? err.message : String(err)).slice(0, 200);
    } finally {
      doc?.free();
      result.ms = Math.round(performance.now() - started);
    }
    results.push(result);
  }
}

const passed = results.filter((r) => r.ok).length;
const summary = {
  rhwpVersion: version(),
  ranAt: new Date().toISOString(),
  total: results.length,
  passed,
  openSuccessRate: results.length ? results.filter((r) => r.checks.open).length / results.length : null,
  hwpxReopenRate: results.length ? results.filter((r) => r.checks.hwpxReopen).length / results.length : null,
  results,
};

mkdirSync(REPORT_DIR, { recursive: true });
const reportPath = join(REPORT_DIR, `compat-${summary.rhwpVersion}.json`);
writeFileSync(reportPath, JSON.stringify(summary, null, 2));

for (const r of results) {
  const failed = Object.entries(r.checks).filter(([, v]) => !v).map(([k]) => k);
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.file}  ${r.pages ?? '-'}쪽  ${r.ms}ms${failed.length ? `  실패: ${failed.join(', ')}` : ''}${r.error ? `  오류: ${r.error}` : ''}`);
}
console.log(`\n${passed}/${results.length} 통과 · rHWP ${summary.rhwpVersion} · 보고서 ${reportPath}`);
if (results.length === 0) {
  console.error('검사할 문서가 없습니다. npm run fixtures:generate 를 먼저 실행하세요.');
  process.exit(1);
}
process.exit(passed === results.length ? 0 : 1);
