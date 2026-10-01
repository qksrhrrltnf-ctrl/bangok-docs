import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReveal } from './useReveal';

interface TocItem {
  id: string;
  title: string;
}

/**
 * 문서형 페이지 레이아웃 (CNM 디자인 가이드 5절).
 * - 본문의 .toc-target 제목을 모아 번호 배지 목차를 자동으로 만든다 (새 카드는 제목에 클래스만 붙이면 편입)
 * - 스크롤 스파이: 지금 보는 절을 목차에서 강조
 * - 960px 미만: 목차는 ☰ 버튼으로 여는 오프캔버스 + 스크림
 */
export function DocLayout({ title, children }: { title: string; children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<TocItem[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useReveal(contentRef, [items.length]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const heads = Array.from(root.querySelectorAll<HTMLElement>('.toc-target'));
    heads.forEach((h, i) => {
      if (!h.id) h.id = `sec-${i + 1}`;
    });
    setItems(heads.map((h) => ({ id: h.id, title: h.dataset.toc ?? h.textContent?.trim() ?? '' })));
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        const first = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (first) setActive(first[0]);
      },
      { rootMargin: '-80px 0px -55% 0px' },
    );
    heads.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, []);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    setActive(id);
    setOpen(false);
    (el as HTMLElement).focus?.({ preventScroll: true });
  };

  return (
    <div className="doc-layout">
      <nav className={`toc ${open ? 'open' : ''}`} aria-label={`${title} 목차`}>
        <p className="toc-heading">{title}</p>
        <ol>
          {items.map((it, i) => (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                className={active === it.id ? 'active' : ''}
                aria-current={active === it.id ? 'location' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  jump(it.id);
                }}
              >
                <span className={`num c${(i % 4) + 1}`} aria-hidden="true">
                  {i + 1}
                </span>
                {it.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className={`toc-scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="doc-content" ref={contentRef}>
        <p>
          <button type="button" className="btn btn-dark menu-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            ☰ 목차
          </button>
        </p>
        {children}
      </div>
    </div>
  );
}
