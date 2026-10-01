const loaded = new Map<string, Promise<void>>();

/** 외부 스크립트를 한 번만 불러온다. Google Identity Services, Picker 에 쓴다. */
export function loadScript(src: string, timeoutMs = 15_000): Promise<void> {
  let p = loaded.get(src);
  if (p) return p;
  p = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.defer = true;
    const timer = setTimeout(() => reject(new Error(`스크립트 로드 시간 초과: ${src}`)), timeoutMs);
    el.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    el.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`스크립트 로드 실패: ${src}`));
    };
    document.head.appendChild(el);
  }).catch((err) => {
    loaded.delete(src);
    throw err;
  });
  loaded.set(src, p);
  return p;
}
