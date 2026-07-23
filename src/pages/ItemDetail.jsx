import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { ArrowLeft, Edit2, MessageSquare, ImageOff } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useObjectUrl } from '../hooks/useObjectUrl';
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
  
  const url = useObjectUrl(item?.photo);

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

  return (
    <div className="item-detail-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label={t('cancel')}>
          <ArrowLeft size={24} />
        </button>
        <button className="edit-btn" onClick={() => navigate(`/edit/${item.id}`)} aria-label={t('editItem')}>
          <Edit2 size={24} />
        </button>
      </header>

      <div className="detail-image-container glass-panel">
        {url ? (
          <img src={url} alt={characterText || seriesText} />
        ) : (
          <div className="empty-state">
            <div className="empty-icon glass-panel">
               <ImageOff size={48} color="var(--text-muted)" />
            </div>
            <h2>{t('noPhoto')}</h2>
          </div>
        )}
      </div>

      <div className="detail-info glass-panel">
        <div className="detail-header">
          <div>
            <h1>{characterText || t('unknownCharacter')}</h1>
            <h2 className="series" style={{ color: 'var(--text-muted)' }}>{seriesText || t('unknownSeries')}</h2>
          </div>
          <span className="detail-badge">{t(item.merchandise_type)}</span>
        </div>

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
  );
}
