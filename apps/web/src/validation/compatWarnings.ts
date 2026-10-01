/**
 * 호환성 경고 문구 만들기 (FR-OPEN-003, 15.4 폰트 정책).
 * rHWP 가 돌려주는 문서 정보(getDocumentInfo)와 저장 손실 보고서(contentLoss)를 해석한다.
 */

export interface CompatInput {
  sourceFormat: 'hwp' | 'hwpx';
  inspectionWarnings: string[];
  info: unknown;
  loss: unknown;
}

export interface CompatReport {
  warnings: string[];
  fontsUsed: string[];
  substitutedFonts: string[];
  lossCount: number;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function strings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (typeof x === 'string') return x;
      const o = obj(x);
      const name = o.original ?? o.from ?? o.requested ?? o.name;
      return typeof name === 'string' ? name : null;
    })
    .filter((x): x is string => Boolean(x));
}

export function buildCompatReport(input: CompatInput): CompatReport {
  const info = obj(input.info);
  const loss = obj(input.loss);
  const warnings = [...input.inspectionWarnings];

  const fontsUsed = strings(info.fontsUsed);
  const substitutedFonts = [...new Set(strings(info.fontSubstitutions))];
  const lossCount = typeof loss.count === 'number' ? loss.count : Array.isArray(loss.losses) ? loss.losses.length : 0;

  if (lossCount > 0) {
    warnings.push(
      `이 문서에는 현재 편집기에서 완전히 지원하지 않는 요소가 ${lossCount}개 포함되어 있습니다. 저장 시 일부 레이아웃이 달라질 수 있습니다.`,
    );
  }
  if (substitutedFonts.length > 0) {
    warnings.push(
      `이 기기에 없는 글꼴(${substitutedFonts.slice(0, 3).join(', ')}${substitutedFonts.length > 3 ? ' 등' : ''})을 비슷한 글꼴로 바꿔 표시합니다. 줄바꿈이나 쪽 나눔이 원본과 다를 수 있습니다.`,
    );
  }
  if (input.sourceFormat === 'hwp') {
    warnings.push('HWP 문서입니다. 저장할 때는 HWPX 형식을 권장합니다.');
  }
  return { warnings, fontsUsed, substitutedFonts, lossCount };
}
