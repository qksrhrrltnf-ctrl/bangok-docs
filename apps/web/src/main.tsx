/*
 * 반곡고 문서 편집기 — Copyright (c) 2026 반곡고등학교 (개발: 반곡고등학교 2026년 정보부장)
 * 본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.
 * 문서 엔진 rHWP: MIT License, Copyright (c) 2025-2026 Edward Kim. 전체 고지는 저장소 루트 NOTICE.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useApp } from './store';
import './styles.css';

// 서비스 워커: 새 버전은 백그라운드에서 받고 다음 실행 때 적용한다 (FR-OFFLINE-004).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onNeedRefresh: () => useApp.getState().setUpdateReady(true),
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
