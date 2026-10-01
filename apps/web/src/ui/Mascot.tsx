import { useEffect, useRef, useState } from 'react';

const TIPS = [
  '안녕! 빈 A4 한 장부터 바로 쓸 수 있어요.',
  'Ctrl+S 로 저장해요.',
  'HWP 파일은 HWPX 로 저장하면 더 안전해요.',
  '제출 전에 PDF 로도 확인해 봐요. Ctrl+P!',
  '저장 안 하고 닫혀도 7일 동안 복구할 수 있어요.',
  '문서는 크롬북 안에서만 처리돼요.',
];

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

/**
 * 레트로 문서 마스코트 (CNM 디자인 가이드 1절).
 * 눈동자가 마우스를 따라가고, 누르면 깡충 뛰며 사용 팁을 말한다.
 */
export function Mascot() {
  const ref = useRef<HTMLButtonElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [tip, setTip] = useState(0);
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        const dx = e.clientX - (box.left + box.width / 2);
        const dy = e.clientY - (box.top + box.height * 0.42);
        const dist = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, dist / 260) * 5;
        setLook({ x: (dx / dist) * k, y: (dy / dist) * k });
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  const next = () => {
    setTip((t) => (t + 1) % TIPS.length);
    setBounce(false);
    requestAnimationFrame(() => setBounce(true));
  };

  const pupil = { transform: `translate(${look.x}px, ${look.y}px)` };

  return (
    <button
      ref={ref}
      type="button"
      className={`mascot ${bounce ? 'bounce' : ''}`}
      onClick={next}
      onAnimationEnd={() => setBounce(false)}
      aria-label={`도우미: ${TIPS[tip]} (누르면 다음 팁)`}
    >
      <span className="bubble" key={tip} aria-hidden="true">
        {TIPS[tip]}
      </span>
      <svg viewBox="0 0 200 230" aria-hidden="true">
        <path d="M40 30 h92 l38 38 v132 a14 14 0 0 1 -14 14 H40 a14 14 0 0 1 -14 -14 V44 a14 14 0 0 1 14 -14 z" fill="#fff" stroke="#151515" strokeWidth="5" strokeLinejoin="round" />
        <path d="M132 30 v26 a12 12 0 0 0 12 12 h26" fill="#F5C842" stroke="#151515" strokeWidth="5" strokeLinejoin="round" />
        <path d="M52 168 h96 M52 186 h70" stroke="#151515" strokeWidth="5" strokeLinecap="round" opacity="0.85" />
        <g className="eye">
          <ellipse cx="76" cy="104" rx="16" ry="18" fill="#fff" stroke="#151515" strokeWidth="4.5" />
          <circle className="pupil" style={pupil} cx="76" cy="106" r="7.5" fill="#151515" />
        </g>
        <g className="eye">
          <ellipse cx="124" cy="104" rx="16" ry="18" fill="#fff" stroke="#151515" strokeWidth="4.5" />
          <circle className="pupil" style={pupil} cx="124" cy="106" r="7.5" fill="#151515" />
        </g>
        <ellipse cx="56" cy="132" rx="11" ry="7" fill="#F58BB6" />
        <ellipse cx="144" cy="132" rx="11" ry="7" fill="#F58BB6" />
        <path d="M86 132 q14 16 28 0" fill="none" stroke="#151515" strokeWidth="5" strokeLinecap="round" />
        <g transform="rotate(-28 176 150)">
          <rect x="166" y="112" width="18" height="72" rx="3" fill="#EE8B37" stroke="#151515" strokeWidth="4.5" />
          <path d="M166 184 l9 18 l9 -18 z" fill="#FFF7E6" stroke="#151515" strokeWidth="4.5" strokeLinejoin="round" />
          <rect x="166" y="104" width="18" height="12" rx="3" fill="#F58BB6" stroke="#151515" strokeWidth="4.5" />
        </g>
      </svg>
    </button>
  );
}

/** 손그림 낙서 장식 (별·물결·반짝이). 화면 읽기 프로그램에는 숨긴다. */
export function Doodles() {
  return (
    <>
      <svg className="doodle" style={{ left: '46%', top: 22 }} width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
        <path d="M27 4 L32 21 L50 22 L36 32 L41 50 L27 39 L13 50 L18 32 L4 22 L22 21 Z" fill="#F5C842" stroke="#151515" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <svg className="doodle doodle-wave" style={{ left: 28, bottom: 18 }} width="150" height="26" viewBox="0 0 150 26" aria-hidden="true">
        <path d="M3 14 q12 -14 24 0 t24 0 t24 0 t24 0 t24 0 t24 0" fill="none" stroke="#2FB07A" strokeWidth="4.5" strokeLinecap="round" />
      </svg>
      <svg className="doodle" style={{ right: '36%', bottom: 26 }} width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <path d="M17 2 v30 M2 17 h30 M7 7 l20 20 M27 7 l-20 20" stroke="#151515" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </>
  );
}
