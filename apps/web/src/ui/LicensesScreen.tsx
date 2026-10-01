import { useEffect, useState } from 'react';
import { BRAND, COPYRIGHT, DEVELOPER_CREDIT, HWP_SPEC_NOTICE, INDEPENDENCE_NOTICE, TRADEMARK_NOTICES } from '../branding';
import { env } from '../env';
import { useApp } from '../store';
import { AppHeader } from './AppHeader';
import { DocLayout } from './DocLayout';

interface LicenseIndex {
  generatedAt: string;
  rhwpVersion: string;
  components: { ecosystem: string; name: string; version: string; license: string | null }[];
}

/** rHWP 라이선스 원문. 고지 파일을 받지 못해도 화면에서 항상 보이도록 앱에 포함한다. */
const RHWP_MIT = `MIT License

Copyright (c) 2025-2026 Edward Kim

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const KEY_COMPONENTS = [
  { name: 'rHWP (@rhwp/core, @rhwp/editor, rhwp-studio)', license: 'MIT', by: 'Copyright (c) 2025-2026 Edward Kim', url: 'https://github.com/edwardkim/rhwp' },
  { name: 'React, React DOM', license: 'MIT', by: 'Copyright (c) Meta Platforms, Inc. and affiliates', url: 'https://github.com/facebook/react' },
  { name: 'Zustand', license: 'MIT', by: 'Copyright (c) 2019 Paul Henschel', url: 'https://github.com/pmndrs/zustand' },
  { name: 'Workbox', license: 'MIT', by: 'Copyright Google LLC', url: 'https://github.com/GoogleChrome/workbox' },
  { name: 'CanvasKit (Skia)', license: 'BSD-3-Clause', by: 'Copyright Google LLC', url: 'https://skia.org' },
  { name: '@noble/hashes', license: 'MIT', by: 'Copyright (c) Paul Miller', url: 'https://github.com/paulmillr/noble-hashes' },
];

const FONTS = [
  { name: '페이퍼로지 (앱 본문 글꼴)', license: 'SIL Open Font License 1.1' },
  { name: '프리젠테이션 (앱 제목 글꼴)', license: 'SIL Open Font License 1.1' },
  { name: '함초롬돋움·함초롬바탕 (대체 표시용)', license: '한컴 무료 글꼴 (수정·판매 금지)' },
  { name: '나눔고딕, 나눔명조, Noto Sans KR', license: 'SIL Open Font License 1.1' },
  { name: 'KoPub 돋움·바탕', license: '한국출판인회의 무료 글꼴' },
];

/** 앱 정보 · 오픈소스 라이선스 · 법적 고지 · 도움말 (PRD 29장, docs/legal-review.md) */
export function LicensesScreen() {
  const go = useApp((s) => s.go);
  const [index, setIndex] = useState<LicenseIndex | null>(null);

  useEffect(() => {
    fetch('/licenses/licenses.json')
      .then((r) => (r.ok ? r.json() : null))
      .then(setIndex, () => setIndex(null));
  }, []);

  const byLicense = new Map<string, number>();
  for (const c of index?.components ?? []) byLicense.set(c.license ?? '표기 없음', (byLicense.get(c.license ?? '표기 없음') ?? 0) + 1);

  return (
    <div className="page">
      <AppHeader title="앱 정보" />
      <DocLayout title="앱 정보">
        <section className="card reveal">
          <h2 className="toc-target" tabIndex={-1} data-toc="앱 정보">
            {BRAND.appName}
          </h2>
          <dl className="kv">
            <dt>운영</dt>
            <dd>{BRAND.schoolName}</dd>
            <dt>개발</dt>
            <dd>
              {BRAND.schoolName} {BRAND.developer}
            </dd>
            <dt>문의</dt>
            <dd>{BRAND.supportContact}</dd>
            <dt>버전</dt>
            <dd>
              앱 {env.appVersion} · 문서 엔진 rHWP {env.rhwpVersion}
            </dd>
          </dl>
          <p className="muted">
            {COPYRIGHT}. {DEVELOPER_CREDIT}. 이 앱을 구성하는 오픈소스 소프트웨어의 저작권은 각 저작권자에게 있습니다.
          </p>
        </section>

        <section className="card reveal" aria-labelledby="notice-title">
          <h2 id="notice-title" className="toc-target" tabIndex={-1}>
            고지
          </h2>
          <p className="key">
            <strong>{HWP_SPEC_NOTICE}</strong>
          </p>
          <ul>
            {TRADEMARK_NOTICES.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p>{INDEPENDENCE_NOTICE}</p>
          <p className="warn">
            이 앱은 있는 그대로 제공됩니다. 중요한 문서는 저장 후 다시 열어 확인하고, 제출 전 PDF로도 확인하세요.
          </p>
        </section>

        <section className="card reveal" aria-labelledby="help-title">
          <h2 id="help-title" className="toc-target" tabIndex={-1}>
            사용 도움말
          </h2>
          <ul>
            <li>새 문서는 HWPX 형식으로 만들어집니다. 한컴오피스 2010 이후 버전에서 열 수 있습니다.</li>
            <li>HWP 파일은 열어서 고칠 수 있고, 저장할 때는 HWPX 새 파일로 저장하는 것을 권장합니다.</li>
            <li>
              저장은 <kbd>Ctrl+S</kbd>, 다른 이름으로 저장은 <kbd>Ctrl+Shift+S</kbd>, PDF는 <kbd>Ctrl+P</kbd> 입니다. PDF 창에서 대상을
              'PDF로 저장' 또는 'Google Drive에 저장'으로 고르세요.
            </li>
            <li>저장하지 않고 닫힌 문서는 처음 화면의 '복구할 수 있는 문서'에서 7일 동안 되살릴 수 있습니다.</li>
            <li>문서는 크롬북 안에서만 처리되고 학교 서버로 보내지 않습니다.</li>
            <li>{HWP_SPEC_NOTICE}</li>
          </ul>
        </section>

        <section className="card reveal" aria-labelledby="oss-title">
          <h2 id="oss-title" className="toc-target" tabIndex={-1}>
            오픈소스 라이선스
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">주요 구성 요소</th>
                <th scope="col">라이선스</th>
                <th scope="col">저작권</th>
              </tr>
            </thead>
            <tbody>
              {KEY_COMPONENTS.map((c) => (
                <tr key={c.name}>
                  <td>
                    <a href={c.url} target="_blank" rel="noreferrer">
                      {c.name}
                    </a>
                  </td>
                  <td>{c.license}</td>
                  <td>{c.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            {index
              ? `이 앱이 포함한 오픈소스 구성 요소는 모두 ${index.components.length}개입니다 (문서 엔진에 컴파일된 Rust 라이브러리 포함). `
              : ''}
            각 구성 요소의 저작권 고지와 라이선스 원문 전체는{' '}
            <a href="/licenses/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">
              제3자 소프트웨어 고지
            </a>
            에 있습니다.
          </p>
          {byLicense.size > 0 && (
            <details>
              <summary>라이선스 분포 보기</summary>
              <p className="muted">
                {[...byLicense.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => `${k} ${v}`)
                  .join(' · ')}
              </p>
            </details>
          )}
          <details>
            <summary>rHWP 라이선스 원문 (MIT)</summary>
            <pre className="license-text">{RHWP_MIT}</pre>
          </details>
        </section>

        <section className="card reveal" aria-labelledby="font-title">
          <h2 id="font-title" className="toc-target" tabIndex={-1}>
            글꼴
          </h2>
          <p className="muted">
            앱 화면은 페이퍼로지·프리젠테이션 글꼴을 쓰고, 편집기는 크롬북에 없는 문서 글꼴을 아래 공개 글꼴로 바꿔 표시합니다. 글꼴
            파일은 공개 글꼴 배포처(jsDelivr)에서 받으며 이 앱이 수정하거나 재배포하지 않습니다.
          </p>
          <ul>
            {FONTS.map((f) => (
              <li key={f.name}>
                {f.name} — {f.license}
              </li>
            ))}
          </ul>
        </section>

        <p className="reveal">
          <button type="button" className="btn btn-primary" onClick={() => go('privacy')}>
            개인정보 처리 안내 보기
          </button>
        </p>
      </DocLayout>
    </div>
  );
}
