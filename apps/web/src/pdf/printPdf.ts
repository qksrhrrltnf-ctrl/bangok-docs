import { AppError } from '../errors';

/**
 * PDF 내보내기 (FR-PDF-001~003).
 * rHWP 는 브라우저 빌드에서 PDF 를 직접 만들지 않으므로, 편집기가 렌더링한 페이지 SVG 를
 * 인쇄 전용 문서로 묶고 Chrome 인쇄 대화상자를 연다. 사용자는 대상에서
 * 'PDF로 저장' 또는 'Google Drive에 저장'을 고른다. 서버 변환은 쓰지 않는다.
 *
 * 보안: 문서에서 나온 SVG 를 다루므로 스크립트가 실행되지 않는 sandbox iframe 을 쓰고,
 * script/foreignObject/이벤트 속성을 제거한다.
 */

export interface PageSource {
  pageCount(): Promise<number>;
  getPageSvg(page: number): Promise<string>;
}

export function sanitizeSvg(svg: string): string {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = doc.documentElement;
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length > 0) {
    throw new AppError('PDF_001', 'SVG 해석 실패');
  }
  root.querySelectorAll('script, foreignObject').forEach((el) => el.remove());
  const all = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const el of all) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      else if ((name === 'href' || name === 'xlink:href') && value.startsWith('javascript:')) el.removeAttribute(attr.name);
    }
  }
  return new XMLSerializer().serializeToString(root);
}

/**
 * 편집기 문서에 로드된 웹폰트를 인쇄 문서로 옮겨 화면과 같은 글꼴로 출력되게 한다 (FR-PDF-002).
 * 편집기가 다른 출처에 있으면 접근할 수 없으므로 조용히 건너뛴다.
 */
function copyWebFonts(from: Document | null, to: Document): void {
  if (!from) return;
  try {
    const rules: string[] = [];
    for (const sheet of Array.from(from.styleSheets)) {
      let cssRules: CSSRuleList;
      try {
        cssRules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(cssRules)) {
        if (rule.constructor.name === 'CSSFontFaceRule' || rule.cssText.startsWith('@font-face')) rules.push(rule.cssText);
      }
    }
    if (rules.length > 0) {
      const style = to.createElement('style');
      style.textContent = rules.join('\n');
      to.head.appendChild(style);
    }
    from.fonts?.forEach((face) => {
      try {
        if (face.status === 'loaded') to.fonts.add(face);
      } catch {
        // 다른 문서의 FontFace 를 받을 수 없는 경우
      }
    });
  } catch {
    // 글꼴 복사는 최선 노력이다
  }
}

function pageSizeOf(svg: string): { width: string; height: string } | null {
  const w = /\swidth="([\d.]+)(px|mm|pt)?"/.exec(svg);
  const h = /\sheight="([\d.]+)(px|mm|pt)?"/.exec(svg);
  if (!w || !h) return null;
  return { width: `${w[1]}${w[2] ?? 'px'}`, height: `${h[1]}${h[2] ?? 'px'}` };
}

export async function printAsPdf(
  source: PageSource,
  fileName: string,
  options: { onProgress?: (done: number, total: number) => void; fontDocument?: Document | null } = {},
): Promise<void> {
  const { onProgress, fontDocument } = options;
  const total = await source.pageCount();
  if (total < 1) throw new AppError('PDF_001', '페이지가 없음');

  const pages: string[] = [];
  for (let i = 0; i < total; i++) {
    pages.push(sanitizeSvg(await source.getPageSvg(i)));
    onProgress?.(i + 1, total);
  }
  const size = pageSizeOf(pages[0]);

  const iframe = document.createElement('iframe');
  // allow-scripts 를 주지 않아 문서 안의 어떤 스크립트도 실행되지 않는다.
  iframe.setAttribute('sandbox', 'allow-same-origin allow-modals');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) throw new AppError('PDF_001', '인쇄 문서를 만들 수 없음');

    doc.open();
    doc.write('<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body></body></html>');
    doc.close();
    doc.title = fileName.replace(/\.(hwpx?)$/i, '');

    const style = doc.createElement('style');
    style.textContent = `
      @page { size: ${size ? `${size.width} ${size.height}` : 'A4'}; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .page { break-after: page; page-break-after: always; overflow: hidden; }
      .page:last-child { break-after: auto; page-break-after: auto; }
      .page > svg { display: block; width: 100%; height: auto; }
    `;
    doc.head.appendChild(style);
    copyWebFonts(fontDocument ?? null, doc);

    for (const svg of pages) {
      const div = doc.createElement('div');
      div.className = 'page';
      const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
      div.appendChild(doc.importNode(parsed, true));
      doc.body.appendChild(div);
    }

    // 웹폰트·이미지가 그려질 시간을 준다.
    await doc.fonts?.ready;
    await new Promise((r) => setTimeout(r, 150));
    win.focus();
    win.print();
  } catch (err) {
    throw err instanceof AppError ? err : new AppError('PDF_001', err instanceof Error ? err.message : String(err), { cause: err });
  } finally {
    // print() 는 대화상자가 닫힐 때까지 막히므로 여기서 정리해도 된다.
    setTimeout(() => iframe.remove(), 1000);
  }
}
