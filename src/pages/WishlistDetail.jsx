import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Edit2, ExternalLink, ImageOff, MessageSquare } from 'lucide-react';
import { db } from '../services/db';
import { useLanguage } from '../contexts/LanguageContext';
import { useObjectUrl } from '../hooks/useObjectUrl';
import {
  DEFAULT_TYPES,
  WISHLIST_PRIORITY_LABELS,
  WISHLIST_STATUS_LABELS,
} from '../utils/constants';
import { getLinkHost, getLinkLabel, isWebUrl } from '../utils/linkUtils';
import { formatValues } from '../utils/valueUtils';
import {
  formatDateKey,
  formatPrice,
  getDeadlineState,
  getWishlistTitle,
} from '../utils/wishlistUtils';
import './AddEditItem.css';
import './Wishlist.css';

export default function WishlistDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const entryId = Number.parseInt(id, 10);
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  const entry = useLiveQuery(
    async () => {
      if (!Number.isInteger(entryId)) return null;
      return (await db.wishlist.get(entryId)) ?? null;
    },
    [entryId],
  );

  const url = useObjectUrl(entry?.photo);

  if (entry === undefined) return <div className="loading">{t('loading')}</div>;
  if (entry === null) {
    return (
      <div className="empty-state item-not-found">
        <h1>{t('noEntriesFound')}</h1>
        <p>{t('wishlistEntryNotFound')}</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/wishlist')}>
          {t('backWishlist')}
        </button>
      </div>
    );
  }

  const separator = lang === 'en' ? ', ' : '、';
  const title = getWishlistTitle(entry, separator) || t('untitledEntry');
  const type = entry.merchandise_type;
  const deadlineDate = formatDateKey(entry.order_deadline, lang);
  const deadlineState = entry.status === 'ordered' ? null : getDeadlineState(entry.order_deadline);

  const facts = [
    { key: 'price', value: formatPrice(entry.price, entry.currency, lang) },
    { key: 'shop', value: entry.shop },
    {
      key: 'orderDeadline',
      value: deadlineState === 'overdue' ? t('deadlinePassed', { date: deadlineDate }) : deadlineDate,
      className: deadlineState ? `deadline-${deadlineState}` : undefined,
    },
    { key: 'release', value: entry.release },
    { key: 'priority', value: t(WISHLIST_PRIORITY_LABELS[entry.priority] ?? 'priorityMedium') },
    { key: 'seriesFranchise', value: formatValues(entry.series, separator) },
    { key: 'character', value: formatValues(entry.character, separator) },
    { key: 'merchandiseType', value: type && (DEFAULT_TYPES.includes(type) ? t(type) : type) },
  ].filter(fact => fact.value);

  // Stored links were validated on save and on import; checking again here keeps a
  // record edited outside the app from ever rendering a script URL.
  const links = (entry.links ?? []).filter(link => isWebUrl(link.url));

  return (
    <div className="item-detail-page wishlist-detail">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate('/wishlist')} aria-label={t('backWishlist')}>
          <ArrowLeft size={24} />
        </button>
        <button
          className="edit-btn"
          onClick={() => navigate(`/wishlist/edit/${entry.id}`)}
          aria-label={t('editWishlistEntry')}
        >
          <Edit2 size={24} />
        </button>
      </header>

      <div className={`detail-image-container glass-panel${isImageExpanded ? ' is-expanded' : ''}`}>
        {url ? (
          // Screenshots are often tall, and their text is unreadable at the default height.
          <button
            type="button"
            className="detail-image-toggle"
            aria-pressed={isImageExpanded}
            aria-label={t('expandImage')}
            onClick={() => setIsImageExpanded(expanded => !expanded)}
          >
            <img src={url} alt={title} />
          </button>
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
          <h1>{title}</h1>
          <span className="detail-badge">{t(WISHLIST_STATUS_LABELS[entry.status] ?? 'statusWant')}</span>
        </div>

        {facts.length > 0 && (
          <dl className="wishlist-facts">
            {facts.map(fact => (
              <div key={fact.key}>
                <dt>{t(fact.key)}</dt>
                <dd className={fact.className}>{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {links.length > 0 && (
          <section className="wishlist-links-section">
            <h3>{t('links')}</h3>
            <ul className="wishlist-links">
              {links.map(link => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={18} aria-hidden="true" />
                    <span className="wishlist-link-label">{getLinkLabel(link)}</span>
                    {link.label && <span className="wishlist-link-host">{getLinkHost(link.url)}</span>}
                    <span className="sr-only">{t('opensInNewTab')}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {entry.notes && (
          <div className="detail-notes form-group">
            <h3 className="wishlist-section-title">
              <MessageSquare size={18} color="var(--accent-primary)" />
              {t('notes')}
            </h3>
            <p className="wishlist-notes">{entry.notes}</p>
          </div>
        )}

        <div className="wishlist-added-on">
          {t('addedOn')} {new Date(entry.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
