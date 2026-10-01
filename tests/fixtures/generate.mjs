#!/usr/bin/env node
/**
 * 합성 테스트 문서 생성 (PRD 32장 Rule 5: 실제 학교 문서는 익명화 없이 쓰지 않는다).
 * 여기서 만드는 문서는 모두 가짜 내용이다. 실제 학교 문서는 tests/fixtures/private/ (커밋 금지)에 둔다.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HwpDocument, version } from '../support/rhwp-node.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'synthetic');
mkdirSync(OUT, { recursive: true });

function blank() {
  const doc = HwpDocument.createEmpty();
  doc.createBlankDocument();
  return doc;
}

function paragraphs(doc, lines) {
  let para = 0;
  lines.forEach((line, i) => {
    if (i > 0) {
      doc.splitParagraph(0, para, [...lines[i - 1]].length);
      para++;
    }
    doc.insertText(0, para, 0, line);
  });
  return para;
}

const fixtures = {
  'text-korean': () => {
    const doc = blank();
    paragraphs(doc, [
      '과학 탐구 보고서',
      '1. 실험 목적: 물의 끓는점을 관찰한다.',
      '2. 준비물: 비커, 온도계, 가열 장치',
      '3. 결과: 약 100도에서 끓기 시작했다.',
    ]);
    return doc;
  },
  'table-worksheet': () => {
    const doc = blank();
    doc.insertText(0, 0, 0, '모둠 활동지');
    doc.splitParagraph(0, 0, [...'모둠 활동지'].length);
    const res = JSON.parse(doc.createTable(0, 1, 0, 2, 2));
    const ctrl = res.controlIdx ?? res.ctrlIdx ?? res.control_idx ?? 0;
    const para = res.paraIdx ?? res.para_idx ?? 1;
    ['이름', '역할', '김하늘', '기록'].forEach((text, cell) => doc.insertTextInCell(0, para, ctrl, cell, 0, 0, text));
    return doc;
  },
  'multi-page': () => {
    const doc = blank();
    const lines = Array.from({ length: 80 }, (_, i) => `${i + 1}번째 문단입니다. 여러 쪽 문서의 쪽 나눔을 확인하기 위한 합성 문장입니다.`);
    paragraphs(doc, lines);
    return doc;
  },
};

for (const [name, make] of Object.entries(fixtures)) {
  const doc = make();
  writeFileSync(join(OUT, `${name}.hwpx`), doc.exportHwpx());
  writeFileSync(join(OUT, `${name}.hwp`), doc.exportHwp());
  console.log(`[fixtures] ${name}: ${doc.pageCount()}쪽`);
  doc.free();
}
console.log(`[fixtures] rHWP ${version()} → ${OUT}`);
