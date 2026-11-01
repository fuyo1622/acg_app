import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Combine, ImagePlus, Images, Ungroup, X } from 'lucide-react';
import { db } from '../services/db';
import AppDialog from '../components/AppDialog';
import { useLanguage } from '../contexts/LanguageContext';
import { useObjectUrls } from '../hooks/useObjectUrl';
import { takeAlbumFiles } from '../utils/albumHandoff';
import { mapWithConcurrency } from '../utils/concurrencyUtils';
import { ALBUM_IMPORT_LIMIT, BACKUP_LIMITS, PHOTO_PROCESSING_CONCURRENCY } from '../utils/constants';
import { compressImage, createThumbnail } from '../utils/imageUtils';
import { isImageFile } from '../utils/photoUtils';
import { createWishlistEntry, readPreferredCurrency } from '../utils/wishlistUtils';
import './AddEditItem.css';
import './AlbumImport.css';

const MAX_PHOTOS = BACKUP_LIMITS.maxPhotosPerRecord;

function createCollectionItem(photos, createdAt) {
  return {
    series: [],
    character: [],
    merchandise_type: '',
    notes: '',
    photos,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

// Turns chosen photos into collection items or wishlist entries. Every photo starts as its
// own item; photos of the same item are merged, and the first photo of each item is its
// cover. Photos can be added in several rounds, such as one album at a time. Collection
// items are saved without details and marked as needing them.
export default function AlbumImport({ target }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isWishlist = target === 'wishlist';
  const listPath = isWishlist ? '/wishlist' : '/';

  const [phase, setPhase] = useState('pick');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [groups, setGroups] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [notice, setNotice] = useState(null);
  const [leavePromptOpen, setLeavePromptOpen] = useState(false);
  const inputRef = useRef(null);
  const nextKeyRef = useRef(1);
  const startedRef = useRef(false);
  // Tiles show small thumbnails: up to 100 full-size photos on screen could run a phone
  // out of memory. The full photos are what gets saved.
  const thumbnailsRef = useRef(new WeakMap());

  const covers = useMemo(
    () => groups.map(group => thumbnailsRef.current.get(group.photos[0]) ?? group.photos[0]),
    [groups],
  );
  const coverUrls = useObjectUrls(covers);

  // `existingCount` is the number of photos already in this import, which shares one limit.
  const processFiles = useCallback(async (files, existingCount = 0) => {
    const images = files.filter(isImageFile);
    if (images.length === 0) {
      setNotice(t('albumNoImages'));
      return;
    }
    const room = ALBUM_IMPORT_LIMIT - existingCount;
    if (images.length > room) {
      setNotice(existingCount > 0
        ? t('albumTooManyMore', { max: ALBUM_IMPORT_LIMIT, remaining: room })
        : t('albumTooMany', { max: ALBUM_IMPORT_LIMIT }));
      return;
    }

    setPhase('processing');
    setProgress({ done: 0, total: images.length });
    try {
      let done = 0;
      const photos = await mapWithConcurrency(images, PHOTO_PROCESSING_CONCURRENCY, async (file) => {
        const photo = await compressImage(file);
        thumbnailsRef.current.set(photo, await createThumbnail(photo));
        done += 1;
        setProgress({ done, total: images.length });
        return photo;
      });
      // New photos join the end, so the tiles and selection from earlier rounds stay as they are.
      setGroups(current => [...current, ...photos.map(photo => ({ key: nextKeyRef.current++, photos: [photo] }))]);
      setPhase('group');
    } catch (error) {
      console.error('Error preparing album photos:', error);
      setNotice(t('saveError'));
      setPhase(existingCount > 0 ? 'group' : 'pick');
    }
  }, [t]);

  // Photos chosen on the list page arrive through the handoff. Opened directly, the page
  // shows its own picker instead.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const files = takeAlbumFiles();
    if (files.length > 0) processFiles(files);
  }, [processFiles]);

  const photoCount = groups.reduce((count, group) => count + group.photos.length, 0);

  const handlePick = (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) processFiles(files, photoCount);
  };

  const isSaving = phase === 'saving';
  const isBusy = isSaving || phase === 'processing';
  const selectedGroups = groups.filter(group => selectedKeys.includes(group.key));
  const canMerge = selectedGroups.length >= 2;
  const canSplit = selectedGroups.some(group => group.photos.length > 1);

  const toggleGroup = (key) => {
    setSelectedKeys(keys => (keys.includes(key) ? keys.filter(selected => selected !== key) : [...keys, key]));
  };

  // Merged photos keep their order in the grid, and the merged item takes the place of
  // the first selected one.
  const mergeSelected = () => {
    const photos = selectedGroups.flatMap(group => group.photos);
    if (photos.length > MAX_PHOTOS) {
      setNotice(t('photoLimit', { max: MAX_PHOTOS }));
      return;
    }
    const firstIndex = groups.findIndex(group => selectedKeys.includes(group.key));
    const remaining = groups.filter(group => !selectedKeys.includes(group.key));
    remaining.splice(firstIndex, 0, { key: nextKeyRef.current++, photos });
    setGroups(remaining);
    setSelectedKeys([]);
  };

  const splitSelected = () => {
    setGroups(groups.flatMap(group => (
      selectedKeys.includes(group.key) && group.photos.length > 1
        ? group.photos.map(photo => ({ key: nextKeyRef.current++, photos: [photo] }))
        : [group]
    )));
    setSelectedKeys([]);
  };

  const removeSelected = () => {
    const remaining = groups.filter(group => !selectedKeys.includes(group.key));
    setGroups(remaining);
    setSelectedKeys([]);
    if (remaining.length === 0) setPhase('pick');
  };

  const addAll = async () => {
    setPhase('saving');
    try {
      const now = Date.now();
      const currency = readPreferredCurrency();
      // Earlier tiles get later timestamps, so they keep this order under "newest first".
      const records = groups.map((group, index) => {
        const createdAt = new Date(now - index);
        return isWishlist
          ? createWishlistEntry({ photos: group.photos, currency, created_at: createdAt, updated_at: createdAt })
          : createCollectionItem(group.photos, createdAt);
      });
      const table = isWishlist ? db.wishlist : db.items;
      // An explicit transaction saves the whole import or none of it. It also avoids a
      // Dexie 4.4 live-query cache bug: when an auto-keyed add fails outside one, the next
      // query of that table throws during render and the page falls into the error boundary.
      await db.transaction('rw', table, () => table.bulkAdd(records));
      navigate(listPath, { replace: true, state: { importedCount: records.length } });
    } catch (error) {
      console.error('Error importing album:', error);
      setNotice(t('saveError'));
      setPhase('group');
    }
  };

  const leave = () => {
    if (groups.length > 0) {
      setLeavePromptOpen(true);
      return;
    }
    navigate(listPath);
  };

  return (
    <div className="form-page album-import">
      <header className="page-header">
        <button className="back-btn" onClick={leave} aria-label={t('cancel')} disabled={isSaving}>
          <ArrowLeft size={24} />
        </button>
        <h2>{t('importAlbum')}</h2>
      </header>

      <input
        type="file"
        accept="image/*"
        multiple
        aria-label={t('albumPhotos')}
        className="sr-only"
        ref={inputRef}
        onChange={handlePick}
      />

      {phase === 'pick' && (
        <section className="album-pick glass-panel">
          <Images size={40} color="var(--accent-primary)" aria-hidden="true" />
          <p>{t(isWishlist ? 'importAlbumHintWishlist' : 'importAlbumHint')}</p>
          <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()}>
            {t('chooseAlbumPhotos')}
          </button>
          <p className="album-pick-limit">{t('albumPickHint', { max: ALBUM_IMPORT_LIMIT })}</p>
        </section>
      )}

      {phase === 'processing' && (
        <p className={`album-progress${groups.length > 0 ? ' is-compact' : ''}`} role="status">
          {t('albumProcessing', progress)}
        </p>
      )}

      {groups.length > 0 && (
        <>
          <p className="album-hint">{t('albumGroupHint')}</p>
          <ul className="album-grid">
            {groups.map((group, index) => {
              const isSelected = selectedKeys.includes(group.key);
              return (
                <li key={group.key}>
                  <button
                    type="button"
                    className={`album-tile glass-panel${isSelected ? ' is-selected' : ''}`}
                    aria-pressed={isSelected}
                    aria-label={t('albumGroupLabel', { index: index + 1, count: group.photos.length })}
                    onClick={() => toggleGroup(group.key)}
                    disabled={isBusy}
                  >
                    {coverUrls[index] && <img src={coverUrls[index]} alt="" />}
                    {group.photos.length > 1 && (
                      <span className="album-tile-count">
                        <Images size={14} aria-hidden="true" />
                        {group.photos.length}
                      </span>
                    )}
                    {isSelected && (
                      <span className="album-tile-check">
                        <Check size={18} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            {photoCount < ALBUM_IMPORT_LIMIT && (
              <li>
                <button
                  type="button"
                  className="album-tile album-tile-add glass-panel"
                  onClick={() => inputRef.current?.click()}
                  disabled={isBusy}
                >
                  <ImagePlus size={24} aria-hidden="true" />
                  <span>{t('addMorePhotos')}</span>
                </button>
              </li>
            )}
          </ul>

          <div className="album-actions">
            <div className="album-tools">
              <button type="button" className="btn btn-secondary" onClick={mergeSelected} disabled={!canMerge || isBusy}>
                <Combine size={18} aria-hidden="true" />
                {t('mergeGroups')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={splitSelected} disabled={!canSplit || isBusy}>
                <Ungroup size={18} aria-hidden="true" />
                {t('splitGroups')}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={removeSelected}
                disabled={selectedKeys.length === 0 || isBusy}
              >
                <X size={18} aria-hidden="true" />
                {t('removeFromImport')}
              </button>
            </div>
            <button
              type="button"
              className="btn btn-primary album-add"
              onClick={addAll}
              disabled={groups.length === 0 || isBusy}
            >
              {isSaving ? t('saving') : t('addImportedItems', { count: groups.length })}
            </button>
          </div>
        </>
      )}

      <AppDialog
        open={leavePromptOpen}
        title={t('discardImportTitle')}
        message={t('discardImportMessage')}
        confirmLabel={t('discard')}
        cancelLabel={t('keepEditing')}
        onConfirm={() => {
          setLeavePromptOpen(false);
          navigate(listPath);
        }}
        onCancel={() => setLeavePromptOpen(false)}
        destructive
      />
      <AppDialog
        open={Boolean(notice)}
        title={t('errorTitle')}
        message={notice}
        confirmLabel={t('close')}
        onConfirm={() => setNotice(null)}
      />
    </div>
  );
}
