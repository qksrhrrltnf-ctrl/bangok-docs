import { BRAND } from '../branding';

/**
 * 개인정보 처리 안내 (개인정보 보호법 제30조 취지, docs/privacy.md 와 같은 내용).
 * 학교의 공식 개인정보 처리방침을 보완하며, 서로 다르면 학교 방침을 따른다.
 */
export function PrivacyNotice({ withToc = false }: { withToc?: boolean }) {
  const h = withToc ? { className: 'toc-target', tabIndex: -1 } : {};
  return (
    <div className="privacy">
      <p>
        {BRAND.schoolName}는 {BRAND.appName}를 운영하면서 다음과 같이 개인정보를 처리합니다. 이 안내는 {BRAND.schoolName} 개인정보
        처리방침을 보완하며, 서로 다른 부분은 학교 처리방침을 따릅니다.
      </p>

      <h3 {...h}>1. 처리 목적</h3>
      <ul>
        <li>학교 Google 계정인지 확인하고 로그인시키기 위해</li>
        <li>크롬북에서 문서를 열고 저장하는 기능을 제공하기 위해</li>
        <li>오류를 찾고 서비스를 개선하기 위해 (개인을 알아볼 수 없는 통계)</li>
      </ul>

      <h3 {...h}>2. 처리하는 정보</h3>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">정보</th>
            <th scope="col">저장 위치</th>
            <th scope="col">보관 기간</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>이름, 학교 이메일, 프로필 사진 (화면 표시용)</td>
            <td>사용하는 크롬북 브라우저</td>
            <td>브라우저 탭을 닫을 때까지</td>
          </tr>
          <tr>
            <td>자동 임시 저장 문서</td>
            <td>사용하는 크롬북 브라우저</td>
            <td>7일, 로그아웃 때 삭제 선택 가능</td>
          </tr>
          <tr>
            <td>최근 문서 목록 (Drive 파일 이름과 ID)</td>
            <td>사용하는 크롬북 브라우저</td>
            <td>목록을 지우거나 브라우저 데이터를 지울 때까지</td>
          </tr>
          <tr>
            <td>Google 계정 고유번호, 역할, 최근 접속 시각 ¹</td>
            <td>학교 운영 서버 (Google Cloud)</td>
            <td>마지막 접속 후 1년 (자동 삭제)</td>
          </tr>
          <tr>
            <td>오류 코드, 앱·브라우저 버전, 파일 형식과 크기 구간 ¹ (누구의 것인지 저장하지 않음)</td>
            <td>학교 운영 서버 (Google Cloud)</td>
            <td>90일</td>
          </tr>
          <tr>
            <td>접속 기록 (IP 주소, 브라우저 정보) ¹</td>
            <td>Google Cloud 로그</td>
            <td>30일</td>
          </tr>
        </tbody>
      </table>
      <p className="muted">¹ 학교가 운영 서버를 켠 경우에만 처리합니다.</p>
      <p className="key">
        <strong>문서 내용과 파일 이름은 학교 서버로 보내지 않습니다.</strong> 문서는 크롬북 안에서 처리되고, 사용자가 고른 크롬북 폴더나
        본인의 Google Drive에만 저장됩니다.
      </p>

      <h3 {...h}>3. Google Drive 접근 범위</h3>
      <p>
        사용자가 직접 고른 파일과 이 앱으로 만든 파일에만 접근합니다(drive.file 권한). Drive의 다른 파일 목록이나 내용은 볼 수 없습니다.
        Google에서 받은 정보는 Google API 서비스 사용자 데이터 정책(제한적 사용 요건 포함)에 따라 문서 편집 기능에만 사용합니다.
      </p>

      <h3 {...h}>4. 제3자 제공과 처리 위탁</h3>
      <ul>
        <li>개인정보를 제3자에게 제공하지 않습니다.</li>
        <li>
          로그인, 저장 공간, 서버 운영은 학교가 이용하는 Google Workspace for Education 과 Google Cloud(Google LLC)를 통해 이루어지며,
          일부 처리는 국외에서 이루어질 수 있습니다.
        </li>
      </ul>

      <h3 {...h}>5. 정보주체의 권리</h3>
      <p>
        학생과 보호자, 교직원은 자신의 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다. 크롬북에 남은 정보는 로그아웃 때 직접 지울
        수 있습니다.
      </p>

      <h3 {...h}>6. 문의</h3>
      <p>
        {BRAND.supportContact} (개인정보 보호책임자는 {BRAND.schoolName} 개인정보 처리방침을 따릅니다)
      </p>
    </div>
  );
}
