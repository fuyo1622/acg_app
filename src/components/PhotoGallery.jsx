import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useObjectUrls } from '../hooks/useObjectUrl';
import './PhotoGallery.css';

// Shows one photo large and, when there are several, thumbnails to switch between them.
// `expandable` lets a tall screenshot open to its full height.
export default function PhotoGallery({ photos, alt, expandable = false }) {
  const { t } = useLanguage();
  const urls = useObjectUrls(photos);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const index = Math.min(selectedIndex, Math.max(photos.length - 1, 0));
  const url = urls[index];

  if (photos.length === 0) {
    return (
      <div className="detail-image-container glass-panel">
        <div className="empty-state">
          <div className="empty-icon glass-panel">
            <ImageOff size={48} color="var(--text-muted)" aria-hidden="true" />
          </div>
          <h2>{t('noPhoto')}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="photo-gallery">
      <div className={`detail-image-container glass-panel${isExpanded ? ' is-expanded' : ''}`}>
        {url && (expandable ? (
          <button
            type="button"
            className="detail-image-toggle"
            aria-pressed={isExpanded}
            aria-label={t('expandImage')}
            onClick={() => setIsExpanded(expanded => !expanded)}
          >
            <img src={url} alt={alt} />
          </button>
        ) : (
          <img src={url} alt={alt} />
        ))}
      </div>

      {photos.length > 1 && (
        // The strip scrolls sideways, so a swipe on it scrolls instead of changing records.
        <div
          className="photo-gallery-thumbs"
          role="group"
          aria-label={t('photoCount', { count: photos.length })}
          data-swipe-ignore
        >
          {photos.map((photo, position) => (
            <button
              key={position}
              type="button"
              className={`photo-gallery-thumb${position === index ? ' is-current' : ''}`}
              aria-pressed={position === index}
              aria-label={t('showPhotoAt', { index: position + 1 })}
              onClick={() => setSelectedIndex(position)}
            >
              {urls[position] && <img src={urls[position]} alt="" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
