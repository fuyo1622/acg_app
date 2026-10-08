import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { APP_RELEASE_URL, APP_VERSION } from '../utils/version';

export default function AppFooter() {
  const { t } = useLanguage();

  return (
    <footer className="home-footer">
      <a
        href={APP_RELEASE_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={t('versionLabel', { version: APP_VERSION })}
      >
        v{APP_VERSION}
      </a>
      <span aria-hidden="true">·</span>
      <Link to="/guide">{t('usageGuide')}</Link>
      <span aria-hidden="true">·</span>
      <a href="https://tally.so/r/KYNy7M" target="_blank" rel="noreferrer">
        {t('sendFeedback')}
      </a>
      <span aria-hidden="true">·</span>
      <Link to="/privacy">{t('privacyPolicy')}</Link>
      <span aria-hidden="true">·</span>
      <a href={`${import.meta.env.BASE_URL}third-party-notices.txt`}>{t('thirdPartyNotices')}</a>
    </footer>
  );
}
