/**
 * 번들에 넣을 수 있는 라이선스인지 판단한다 (docs/legal-review.md 2절).
 * 카피레프트·비상업 조건만 있는 구성 요소는 막고, "MIT OR LGPL" 처럼 허용형 선택지가 있으면 통과시킨다.
 */
export const BLOCKED = /\b(A?GPL|LGPL|SSPL|EUPL|OSL|CC-BY-NC|CC-BY-SA|Commons-Clause|BUSL)\b/i;

export function isBlocked(expr) {
  if (!expr) return false;
  const options = expr.replace(/[()]/g, ' ').split(/\s+OR\s+|\//i);
  return options.every((opt) => BLOCKED.test(opt));
}
