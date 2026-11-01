import { useRef, useState } from 'react';
import { ImagePlus, Star, Upload, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useObjectUrls } from '../hooks/useObjectUrl';
import { BACKUP_LIMITS } from '../utils/constants';
import { isImageFile } from '../utils/photoUtils';
import './PhotoListEditor.css';

const MAX_PHOTOS = BACKUP_LIMITS.maxPhotosPerRecord;

// Edits the photos of one item. The first photo is the cover shown on cards. Newly
// chosen files stay as they are here and are compressed when the form is saved.
export default function PhotoListEditor({ photos, onChange }) {
  const { t } = useLanguage();
  const inputRef = useRef(null);
  const urls = useObjectUrls(photos);
  const [isOverLimit, setIsOverLimit] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const addFiles = (event) => {
    const chosen = Array.from(event.target.files ?? []).filter(isImageFile);
    event.target.value = '';
    if (chosen.length === 0) return;

    const room = MAX_PHOTOS - photos.length;
    setIsOverLimit(chosen.length > room);
    if (room > 0) onChange([...photos, ...chosen.slice(0, room)]);
  };

  const removeAt = (index) => {
    setIsOverLimit(false);
    onChange(photos.filter((_, position) => position !== index));
  };

  const makeCover = (index) => {
    onChange([photos[index], ...photos.filter((_, position) => position !== index)]);
  };

  return (
    <div className="photo-list-editor">
      <input
        type="file"
        accept="image/*"
        multiple
        aria-label={t('addPhoto')}
        className="sr-only"
        ref={inputRef}
        onChange={addFiles}
      />

      {photos.length === 0 ? (
        <button type="button" className="photo-list-empty glass-panel" onClick={openPicker}>
          <span className="photo-list-empty-icon">
            <Upload size={32} color="var(--accent-primary)" aria-hidden="true" />
          </span>
          <strong>{t('addPhoto')}</strong>
          <span>{t('tapToTake')}</span>
        </button>
      ) : (
        <ul className="photo-list-grid">
          {photos.map((photo, index) => (
            <li key={index} className="photo-list-item glass-panel">
              {urls[index] && (
                <img src={urls[index]} alt={t('photoPosition', { index: index + 1, count: photos.length })} />
              )}
              {index === 0 ? (
                <span className="photo-cover-label">{t('coverPhoto')}</span>
              ) : (
                <button
                  type="button"
                  className="photo-action photo-make-cover"
                  onClick={() => makeCover(index)}
                  aria-label={t('makeCoverAt', { index: index + 1 })}
                  title={t('makeCoverAt', { index: index + 1 })}
                >
                  <Star size={16} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                className="photo-action photo-remove"
                onClick={() => removeAt(index)}
                aria-label={t('removePhotoAt', { index: index + 1 })}
                title={t('removePhotoAt', { index: index + 1 })}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
          {photos.length < MAX_PHOTOS && (
            <li>
              <button type="button" className="photo-list-add glass-panel" onClick={openPicker}>
                <ImagePlus size={24} aria-hidden="true" />
                <span>{t('addMorePhotos')}</span>
              </button>
            </li>
          )}
        </ul>
      )}

      {isOverLimit && (
        <p className="photo-list-limit" role="status">{t('photoLimit', { max: MAX_PHOTOS })}</p>
      )}
    </div>
  );
}
