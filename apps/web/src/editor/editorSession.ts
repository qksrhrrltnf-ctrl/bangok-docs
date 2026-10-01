/*
 * 반곡고 문서 편집기 — Copyright (c) 2026 반곡고등학교 (개발: 반곡고등학교 2026년 정보부장)
 * 본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
 * 문서 엔진 rHWP: MIT License, Copyright (c) 2025-2026 Edward Kim. 전체 고지는 저장소 루트 NOTICE.
 */
import { createEditor, type RhwpEditor } from '@rhwp/editor';
import { STUDIO_URL } from '../env';
import { AppError } from '../errors';
import type { DocFormat } from '../validation/inspect';

/**
 * rhwp-studio(자체 호스팅, embed 프로필) 래퍼.
 * embed 프로필에서 편집기는 열기·저장·인쇄를 하지 않고, 이 앱이 문서 수명주기를 맡는다.
 */

export interface EditorShortcuts {
  save?: () => void;
  saveAs?: () => void;
  print?: () => void;
}

export class EditorSession {
  private constructor(
    private readonly editor: RhwpEditor,
    private readonly detach: () => void,
  ) {}

  static async mount(container: HTMLElement, shortcuts: EditorShortcuts = {}): Promise<EditorSession> {
    let editor: RhwpEditor;
    try {
      editor = await createEditor(container, {
        studioUrl: STUDIO_URL,
        renderer: 'canvas2d',
        requestTimeoutMs: 60_000,
        handshakeTimeoutMs: 3000,
      });
    } catch (err) {
      throw new AppError('EDITOR_001', err instanceof Error ? err.message : String(err), { cause: err });
    }
    editor.element.title = '문서 편집 영역';
    const detach = attachShortcuts(editor.element, shortcuts);
    return new EditorSession(editor, detach);
  }

  async load(bytes: Uint8Array, fileName: string): Promise<number> {
    const copy = bytes.slice();
    const result = await this.editor.loadFile(copy, fileName, { skipUnsavedGuard: true, suppressDialogs: true });
    return result.pageCount;
  }

  async export(format: DocFormat): Promise<Uint8Array> {
    try {
      return format === 'hwpx' ? await this.editor.exportHwpx() : await this.editor.exportHwp();
    } catch (err) {
      throw new AppError('SAVE_001', err instanceof Error ? err.message : String(err), { cause: err });
    }
  }

  pageCount(): Promise<number> {
    return this.editor.pageCount();
  }

  getPageSvg(page: number): Promise<string> {
    return this.editor.getPageSvg(page);
  }

  /** 편집 중인지(저장하지 않은 변경이 있는지) 확인한다. 문서 전체 해시를 계산하지 않는 가벼운 조회다. */
  async isDirty(): Promise<boolean> {
    try {
      const ctx = await this.editor.commands.context();
      return Boolean((ctx as { isDirty?: unknown }).isDirty);
    } catch {
      return false;
    }
  }

  /** 저장이 끝났음을 편집기에 알린다. 편집기의 변경 표시와 자체 복구 사본이 정리된다. */
  async markSaved(fileName: string): Promise<void> {
    try {
      await this.editor.notifySaved(fileName);
    } catch {
      // 구버전 편집기는 notify-saved 를 지원하지 않는다. 저장 자체는 이미 끝났다.
    }
  }

  focus(): void {
    this.editor.element.focus();
  }

  destroy(): void {
    this.detach();
    this.editor.destroy();
  }
}

/**
 * embed 프로필은 Ctrl+S / Ctrl+P 를 삼키기만 한다(브라우저 대화상자 방지).
 * 편집기가 같은 출처에서 실행되므로 iframe 안의 키 입력을 받아 앱 기능으로 연결한다.
 */
function attachShortcuts(iframe: HTMLIFrameElement, shortcuts: EditorShortcuts): () => void {
  const handler = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 's' && e.shiftKey && shortcuts.saveAs) {
      e.preventDefault();
      shortcuts.saveAs();
    } else if (key === 's' && !e.shiftKey && shortcuts.save) {
      e.preventDefault();
      shortcuts.save();
    } else if (key === 'p' && !e.shiftKey && shortcuts.print) {
      e.preventDefault();
      shortcuts.print();
    }
  };
  let target: Window | null = null;
  const bind = () => {
    try {
      target?.removeEventListener('keydown', handler, true);
      target = iframe.contentWindow;
      target?.addEventListener('keydown', handler, true);
    } catch {
      // 다른 출처에 편집기를 둔 경우에는 도구 막대 버튼만 쓴다
      target = null;
    }
  };
  bind();
  iframe.addEventListener('load', bind);
  window.addEventListener('keydown', handler, true);
  return () => {
    iframe.removeEventListener('load', bind);
    window.removeEventListener('keydown', handler, true);
    try {
      target?.removeEventListener('keydown', handler, true);
    } catch {
      // 무시
    }
  };
}
