import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import './Home.css';

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="empty-state not-found-page">
      <div className="empty-icon glass-panel">
        <Compass size={48} color="var(--accent-primary)" aria-hidden="true" />
      </div>
      <h1>{t('routeNotFoundTitle')}</h1>
      <p>{t('routeNotFoundMessage')}</p>
      <Link className="btn btn-primary" to="/">{t('backHome')}</Link>
    </div>
  );
}
