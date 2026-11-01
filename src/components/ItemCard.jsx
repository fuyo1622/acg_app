import { Link } from 'react-router-dom';
import { Images } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { getCoverPhoto, getPhotos } from '../utils/photoUtils';
import { needsDetails } from '../utils/validationUtils';
import { formatValues } from '../utils/valueUtils';

// `order` is the list's order of item ids, which the item page uses to move between them.
export default function ItemCard({ item, order }) {
  const { t, lang } = useLanguage();
  const cover = getCoverPhoto(item);
  const imageUrl = useObjectUrl(cover);
  const photoCount = getPhotos(item).length;
  const separator = lang === 'en' ? ', ' : '、';
  const characterText = formatValues(item.character, separator);
  const seriesText = formatValues(item.series, separator);

  return (
    <Link
      to={`/item/${item.id}`}
      state={order ? { order } : undefined}
      className="item-card glass-panel"
    >
      <div className="image-container">
        {cover ? (
          <img src={imageUrl} alt={characterText || seriesText || t('untitledEntry')} loading="lazy" />
        ) : (
          <div className="no-image">{t('noPhoto')}</div>
        )}
        {needsDetails(item) && (
          <div className="item-badge needs-details-badge">{t('needsDetails')}</div>
        )}
        {item.merchandise_type && <div className="item-badge">{t(item.merchandise_type)}</div>}
        {photoCount > 1 && (
          <div className="photo-count-badge" role="img" aria-label={t('photoCount', { count: photoCount })}>
            <Images size={14} aria-hidden="true" />
            {photoCount}
          </div>
        )}
      </div>
      <div className="item-info">
        <h3>{characterText || t('unknownCharacter')}</h3>
        <p className="series">{seriesText || t('unknownSeries')}</p>
      </div>
    </Link>
  );
}
