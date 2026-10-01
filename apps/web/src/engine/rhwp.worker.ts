/// <reference lib="webworker" />
/*
 * 반곡고 문서 편집기 — Copyright (c) 2026 반곡고등학교 (개발: 반곡고등학교 2026년 정보부장)
 * 본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
 * 문서 엔진 rHWP: MIT License, Copyright (c) 2025-2026 Edward Kim. 전체 고지는 저장소 루트 NOTICE.
 */
/**
 * rHWP 문서 엔진 워커.
 * 저장 전 재파싱 검증(FR-SAVE-005)과 새 문서 템플릿 생성을 메인 스레드 밖에서 처리한다.
 * 파싱이 멈추거나 메모리를 과하게 쓰면 메인 스레드가 이 워커를 종료한다 (PRD 14장).
 */
import init, { HwpDocument, version } from '@rhwp/core';

export type EngineRequest =
  | { id: number; type: 'init'; wasmUrl: string }
  | { id: number; type: 'parse'; bytes: Uint8Array; lossCheck?: 'hwpx' | 'hwp' }
  | { id: number; type: 'blank' };

export type EngineResponse =
  | { id: number; ok: true; version?: string; pageCount?: number; info?: unknown; loss?: unknown; bytes?: Uint8Array }
  | { id: number; ok: false; message: string };

declare const self: DedicatedWorkerGlobalScope;

let ready: Promise<string> | null = null;

function installTextMeasure(): void {
  // rHWP 는 줄바꿈 계산에 텍스트 폭 측정 함수가 필요하다 (WASM 초기화 전에 등록).
  const ctx = new OffscreenCanvas(1, 1).getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2D 컨텍스트를 만들 수 없습니다');
  let lastFont = '';
  (globalThis as unknown as { measureTextWidth: (font: string, text: string) => number }).measureTextWidth = (
    font,
    text,
  ) => {
    if (font !== lastFont) {
      ctx.font = font;
      lastFont = font;
    }
    return ctx.measureText(text).width;
  };
}

function reply(message: EngineResponse, transfer: Transferable[] = []): void {
  self.postMessage(message, transfer);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : JSON.stringify(err);
}

self.onmessage = async (event: MessageEvent<EngineRequest>) => {
  const msg = event.data;
  try {
    if (msg.type === 'init') {
      ready ??= (async () => {
        installTextMeasure();
        await init({ module_or_path: msg.wasmUrl });
        return version();
      })();
      reply({ id: msg.id, ok: true, version: await ready });
      return;
    }

    if (!ready) throw new Error('엔진이 초기화되지 않았습니다');
    await ready;

    if (msg.type === 'parse') {
      const doc = new HwpDocument(msg.bytes);
      try {
        const pageCount = doc.pageCount();
        let info: unknown = null;
        try {
          info = JSON.parse(doc.getDocumentInfo());
        } catch {
          info = null;
        }
        // 저장 시 달라지거나 빠지는 요소가 있는지 미리 확인한다 (FR-OPEN-003).
        let loss: unknown = null;
        if (msg.lossCheck) {
          try {
            const report = msg.lossCheck === 'hwpx' ? doc.exportHwpxWithReport() : doc.exportHwpWithReport();
            try {
              loss = JSON.parse(report.contentLoss());
            } finally {
              report.free();
            }
          } catch {
            loss = null;
          }
        }
        reply({ id: msg.id, ok: true, pageCount, info, loss });
      } finally {
        doc.free();
      }
      return;
    }

    if (msg.type === 'blank') {
      // 번들된 한글 호환 빈 문서 템플릿(A4)을 HWPX 로 직렬화한다.
      const doc = HwpDocument.createEmpty();
      try {
        doc.createBlankDocument();
        const bytes = doc.exportHwpx();
        reply({ id: msg.id, ok: true, bytes, pageCount: doc.pageCount() }, [bytes.buffer]);
      } finally {
        doc.free();
      }
    }
  } catch (err) {
    reply({ id: msg.id, ok: false, message: errorMessage(err) });
  }
};
