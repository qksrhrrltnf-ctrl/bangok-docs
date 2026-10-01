import { AppHeader } from './AppHeader';
import { DocLayout } from './DocLayout';
import { PrivacyNotice } from './PrivacyNotice';

export function PrivacyScreen() {
  return (
    <div className="page">
      <AppHeader title="개인정보 처리 안내" />
      <DocLayout title="개인정보 처리 안내">
        <section className="card reveal">
          <PrivacyNotice withToc />
        </section>
      </DocLayout>
    </div>
  );
}
