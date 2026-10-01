import { useEffect, type RefObject } from 'react';

/**
 * 스크롤 등장 효과 (CNM 디자인 가이드 5절).
 * 컨테이너 안의 .reveal 요소가 화면에 들어오면 .in 을 붙이고, 벗어나면 뗀다.
 * 동작 줄이기 설정이거나 IntersectionObserver 가 없으면 바로 보이게 한다.
 */
export function useReveal(root: RefObject<HTMLElement | null>, deps: unknown[] = []): void {
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const items = Array.from(container.querySelectorAll<HTMLElement>('.reveal'));
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      items.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.target.classList.toggle('in', e.isIntersecting);
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
    );
    items.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i, 6) * 45}ms`;
      io.observe(el);
    });
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
