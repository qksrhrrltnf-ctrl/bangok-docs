import { useEffect, useState } from 'react';
import type { FeatureFlags } from '../config/flags';
import { loadStudioManifest } from '../engine/engine';
import { driveConfigured, env, googleConfigured } from '../env';
import { useApp } from '../store';
import { AppHeader } from './AppHeader';

interface Summary {
  activeUsers7d?: number;
  events7d?: Record<string, number>;
  saveFailureRate7d?: number | null;
  openFailureRate7d?: number | null;
  topErrorCodes7d?: { code: string; count: number }[];
}

const FLAG_LABELS: Record<keyof FeatureFlags, string> = {
  allowHwpOpen: 'HWP 열기',
  allowHwpSave: 'HWP 호환 저장',
  allowHwpxOpen: 'HWPX 열기',
  allowHwpxSave: 'HWPX 저장',
  allowPdfExport: 'PDF 내보내기',
  allowDriveIntegration: 'Google Drive 연동',
  maintenanceMode: '점검 모드',
};

function pct(v: number | null | undefined): string {
  return typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—';
}

/**
 * 관리자 화면 (PRD 36장). 문서 내용은 볼 수 없고, 버전·기능 플래그·집계 지표만 보여 준다.
 * 기능 플래그 변경은 백엔드가 있으면 Firestore, 없으면 배포하는 config.json 에서 한다.
 */
export function AdminScreen() {
  const config = useApp((s) => s.config)!;
  const idToken = useApp((s) => s.idToken);
  const [studioVersion, setStudioVersion] = useState<string>('확인 중…');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    loadStudioManifest().then(
      (m) => setStudioVersion(m.rhwpVersion),
      () => setStudioVersion('편집기 빌드 없음'),
    );
  }, []);

  useEffect(() => {
    if (!env.apiBase) return;
    if (!idToken) {
      setSummaryError('로그인 토큰을 받는 중입니다. 잠시 후 다시 열어 주세요.');
      return;
    }
    fetch(`${env.apiBase}/admin/summary`, { headers: { Authorization: `Bearer ${idToken}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSummary((await res.json()) as Summary);
      })
      .catch((err) => setSummaryError(err instanceof Error ? err.message : String(err)));
  }, [idToken]);

  return (
    <div className="page">
      <AppHeader title="관리자" />
      <main className="page-main">
        <section className="card">
          <h2>버전</h2>
          <dl className="kv">
            <dt>앱 버전</dt>
            <dd>{env.appVersion}</dd>
            <dt>rHWP (앱 번들)</dt>
            <dd>{env.rhwpVersion}</dd>
            <dt>rHWP (편집기 빌드)</dt>
            <dd>
              {studioVersion}
              {studioVersion !== env.rhwpVersion && /^\d/.test(studioVersion) && <strong className="form-error"> 버전 불일치</strong>}
            </dd>
            <dt>Google 로그인</dt>
            <dd>{googleConfigured ? `설정됨 (${env.allowedDomain})` : '미설정'}</dd>
            <dt>Google Drive</dt>
            <dd>{driveConfigured ? '설정됨' : '미설정'}</dd>
            <dt>설정 출처</dt>
            <dd>{{ api: '백엔드 API', static: 'config.json', cache: '마지막 저장값', default: '내장 기본값' }[config.source]}</dd>
          </dl>
        </section>

        <section className="card">
          <h2>기능 플래그</h2>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">기능</th>
                <th scope="col">상태</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(FLAG_LABELS) as (keyof FeatureFlags)[]).map((k) => (
                <tr key={k}>
                  <td>{FLAG_LABELS[k]}</td>
                  <td>{config.flags[k] ? '켜짐' : '꺼짐'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">
            변경 방법: 백엔드가 있으면 Firestore <code>appConfig/current</code> 문서를, 없으면 배포하는 <code>config.json</code> 을 고칩니다.
            자세한 절차는 docs/operations.md 에 있습니다.
          </p>
        </section>

        <section className="card">
          <h2>운영 지표 (최근 7일)</h2>
          {!env.apiBase ? (
            <p className="muted">백엔드(VITE_API_BASE)가 설정되지 않아 지표를 모으지 않습니다.</p>
          ) : summaryError ? (
            <p className="form-error">지표를 불러오지 못했습니다: {summaryError}</p>
          ) : !summary ? (
            <p className="muted">불러오는 중…</p>
          ) : (
            <dl className="kv">
              <dt>활성 사용자</dt>
              <dd>{summary.activeUsers7d ?? '—'}</dd>
              <dt>파일 열기 실패율</dt>
              <dd>{pct(summary.openFailureRate7d)}</dd>
              <dt>저장 실패율</dt>
              <dd>{pct(summary.saveFailureRate7d)}</dd>
              <dt>주요 오류 코드</dt>
              <dd>{summary.topErrorCodes7d?.map((e) => `${e.code} (${e.count})`).join(', ') || '없음'}</dd>
            </dl>
          )}
          <p className="muted">관리자 화면에서도 학생 문서의 내용과 파일 이름은 볼 수 없습니다.</p>
        </section>
      </main>
    </div>
  );
}
