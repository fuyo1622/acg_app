import { Link } from 'react-router-dom';
import { Images } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { WISHLIST_STATUS_LABELS } from '../utils/constants';
import { getCoverPhoto, getPhotos } from '../utils/photoUtils';
import {
  formatDateKey,
  formatPrice,
  getDeadlineState,
  getWishlistSubtitle,
  getWishlistTitle,
} from '../utils/wishlistUtils';

export default function WishlistCard({ entry }) {
  const { t, lang } = useLanguage();
  const cover = getCoverPhoto(entry);
  const imageUrl = useObjectUrl(cover);
  const photoCount = getPhotos(entry).length;
  const separator = lang === 'en' ? ', ' : '、';
  const title = getWishlistTitle(entry, separator) || t('untitledEntry');
  const subtitle = getWishlistSubtitle(entry, separator);
  const meta = [formatPrice(entry.price, entry.currency, lang), entry.shop].filter(Boolean).join(' · ');

  // An order deadline stops mattering once the entry has been ordered.
  const deadlineState = entry.status === 'ordered' ? null : getDeadlineState(entry.order_deadline);
  const deadlineText = deadlineState && t(
    deadlineState === 'overdue' ? 'deadlinePassed' : 'orderBy',
    { date: formatDateKey(entry.order_deadline, lang) },
  );

  return (
    <Link
      to={`/wishlist/item/${entry.id}`}
      className="item-card wishlist-card glass-panel"
    >
      <div className="image-container">
        {cover ? (
          <img src={imageUrl} alt={title} loading="lazy" />
        ) : (
          <div className="no-image">{t('noPhoto')}</div>
        )}
        {entry.priority === 'high' && (
          <div className="item-badge wishlist-priority-badge">{t('highPriority')}</div>
        )}
        <div className="item-badge">{t(WISHLIST_STATUS_LABELS[entry.status] ?? 'statusWant')}</div>
        {photoCount > 1 && (
          <div className="photo-count-badge" role="img" aria-label={t('photoCount', { count: photoCount })}>
            <Images size={14} aria-hidden="true" />
            {photoCount}
          </div>
        )}
      </div>
      <div className="item-info">
        <h3>{title}</h3>
        {subtitle && <p className="series">{subtitle}</p>}
        {meta && <p className="wishlist-meta">{meta}</p>}
        {deadlineText && (
          <p className={`deadline-chip deadline-${deadlineState}`}>{deadlineText}</p>
        )}
      </div>
    </Link>
  );
}
