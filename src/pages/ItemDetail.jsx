import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { ArrowLeft, Edit2, MessageSquare } from 'lucide-react';
import PhotoGallery from '../components/PhotoGallery';
import SiblingNav from '../components/SiblingNav';
import { useLanguage } from '../contexts/LanguageContext';
import { useSiblingNavigation } from '../hooks/useSiblingNavigation';
import { useSwipe } from '../hooks/useSwipe';
import { getPhotos } from '../utils/photoUtils';
import { describeMissingDetails, getMissingDetails } from '../utils/validationUtils';
import { formatValues } from '../utils/valueUtils';
import './AddEditItem.css'; // Reusing some base styles

export default function ItemDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const itemId = Number.parseInt(id, 10);

  const item = useLiveQuery(
    async () => {
      if (!Number.isInteger(itemId)) return null;
      return (await db.items.get(itemId)) ?? null;
    },
    [itemId],
  );

  const photos = useMemo(() => getPhotos(item), [item]);
  const navigation = useSiblingNavigation({ table: db.items, id: itemId, path: '/item' });
  const swipe = useSwipe({ onSwipeLeft: navigation.goNext, onSwipeRight: navigation.goPrevious });

  if (item === undefined) return <div className="loading">{t('loading')}</div>;
  if (item === null) {
    return (
      <div className="empty-state item-not-found">
        <h1>{t('noItemsFound')}</h1>
        <p>{t('itemNotFound')}</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
          {t('backHome')}
        </button>
      </div>
    );
  }

  const separator = lang === 'en' ? ', ' : '、';
  const characterText = formatValues(item.character, separator);
  const seriesText = formatValues(item.series, separator);
  const missing = getMissingDetails(item);
  const openEditor = () => {
    if (navigation.linkState) navigate(`/edit/${item.id}`, { state: navigation.linkState });
    else navigate(`/edit/${item.id}`);
  };

  return (
    <div className="item-detail-page" {...swipe}>
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/')} aria-label={t('backHome')}>
          <ArrowLeft size={24} />
        </button>
        <SiblingNav navigation={navigation} />
        <button className="edit-btn" onClick={openEditor} aria-label={t('editItem')}>
          <Edit2 size={24} />
        </button>
      </header>

      {/* Keyed by record, so a photo chosen on one item does not carry over to the next. */}
      <div key={item.id} className={navigation.slideFrom ? `detail-slide-from-${navigation.slideFrom}` : undefined}>
        <PhotoGallery photos={photos} alt={characterText || seriesText || t('untitledEntry')} />

        <div className="detail-info glass-panel">
          <div className="detail-header">
            <div>
              <h1>{characterText || t('unknownCharacter')}</h1>
              <h2 className="series" style={{ color: 'var(--text-muted)' }}>{seriesText || t('unknownSeries')}</h2>
            </div>
            {item.merchandise_type && <span className="detail-badge">{t(item.merchandise_type)}</span>}
          </div>

          {missing.length > 0 && (
            <div className="needs-details-notice">
              <p>
                <strong>{t('needsDetails')}</strong>
                {' '}
                {t('itemNeedsDetails', { fields: describeMissingDetails(missing, t, lang) })}
              </p>
              <button type="button" className="btn btn-secondary" onClick={openEditor}>
                {t('fillInDetails')}
              </button>
            </div>
          )}

          {item.notes && (
            <div className="detail-notes form-group">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '1rem' }}>
                <MessageSquare size={18} color="var(--accent-primary)" />
                {t('notes')}
              </h3>
              <p style={{ background: 'var(--bg-dark)', padding: '1rem', borderRadius: '12px', whiteSpace: 'pre-wrap' }}>
                {item.notes}
              </p>
            </div>
          )}

          <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            {t('addedOn')} {new Date(item.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}
