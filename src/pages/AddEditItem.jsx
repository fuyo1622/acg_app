import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { ArrowLeft, Camera, PackageCheck, Save, Trash2 } from 'lucide-react';
import MultiSelectCombobox from '../components/MultiSelectCombobox';
import AppDialog from '../components/AppDialog';
import PhotoListEditor from '../components/PhotoListEditor';
import { useLanguage } from '../contexts/LanguageContext';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { BACKUP_LIMITS, DEFAULT_TYPES } from '../utils/constants';
import { describeMissingDetails, getMissingDetails } from '../utils/validationUtils';
import { getUniqueValues } from '../utils/filterUtils';
import { getCoverPhoto, getPhotos, isImageFile, preparePhotosForSaving } from '../utils/photoUtils';
import { isSameValue, toValueArray } from '../utils/valueUtils';
import { getWishlistTitle, notesForCollection } from '../utils/wishlistUtils';
import './AddEditItem.css';

// With mode="move" (/wishlist/move/:id) the form turns a wishlist entry into a collection
// item: the id is the entry's, and saving adds the item and removes the entry.
export default function AddEditItem({ mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const isMoving = mode === 'move';
  const isEditing = !isMoving && !!id;

  const [formData, setFormData] = useState({
    series: [],
    character: [],
    merchandise_type: '', // Empty means nothing selected yet
    notes: '',
  });
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(isEditing || isMoving);
  const [isSaving, setIsSaving] = useState(false);
  const [customType, setCustomType] = useState('');
  const [notice, setNotice] = useState(null);
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);
  const [unfinishedPromptOpen, setUnfinishedPromptOpen] = useState(false);
  // Moving starts by asking for a photo of the item that arrived.
  const [isPhotoStepDone, setIsPhotoStepDone] = useState(!isMoving);
  const movePhotoInputRef = useRef(null);

  // The collection item's id when editing, the wishlist entry's id when moving.
  const recordId = Number.parseInt(id, 10);
  let exitPath = '/';
  if (isMoving) exitPath = `/wishlist/item/${id}`;
  else if (isEditing) exitPath = `/item/${id}`;
  // The item page's list order, handed back so moving between items still follows it.
  const returnState = isEditing && Array.isArray(location.state?.order) ? { order: location.state.order } : null;
  const leave = () => (returnState ? navigate(exitPath, { state: returnState }) : navigate(exitPath));

  // Fetch all items for autocomplete
  const allItems = useLiveQuery(() => db.items.toArray());
  const { uniqueSeries, uniqueCharacters, uniqueCustomTypes } = useMemo(
    () => getUniqueValues(allItems),
    [allItems],
  );

  // Fetch the item being edited or the entry being moved. The wrapper objects separate
  // "still loading" from "not found". An id that is not a number is not a valid IndexedDB
  // key, so it counts as not found.
  const loadedItem = useLiveQuery(
    async () => {
      if (!isEditing) return null;
      if (!Number.isInteger(recordId)) return { item: null };
      return { item: (await db.items.get(recordId)) ?? null };
    },
    [recordId, isEditing],
  );
  const loadedEntry = useLiveQuery(
    async () => {
      if (!isMoving) return null;
      if (!Number.isInteger(recordId)) return { entry: null };
      return { entry: (await db.wishlist.get(recordId)) ?? null };
    },
    [recordId, isMoving],
  );
  const movingEntry = isMoving ? loadedEntry?.entry : null;
  const wishlistPhotoCount = getPhotos(movingEntry).length;
  const wishlistPhotoUrl = useObjectUrl(getCoverPhoto(movingEntry));

  // Fill the form once, and only after the type list has loaded. Classifying the type
  // against an empty list would push an already-listed type into the free-text box.
  const isFormInitialized = useRef(false);
  useEffect(() => {
    if (!(isEditing || isMoving) || isFormInitialized.current) return;
    const loaded = isMoving ? loadedEntry : loadedItem;
    if (!loaded || allItems === undefined) return;

    const record = isMoving ? loaded.entry : loaded.item;
    if (!record) {
      navigate(isMoving ? '/wishlist' : '/', { replace: true });
      return;
    }

    let selectedType = record.merchandise_type || '';
    const listedType = [...DEFAULT_TYPES, ...uniqueCustomTypes]
      .find(type => isSameValue(type, selectedType));

    if (listedType) {
      selectedType = listedType;
    } else if (selectedType) {
      setCustomType(selectedType);
      selectedType = '__custom__';
    }

    setFormData({
      series: toValueArray(record.series),
      character: toValueArray(record.character),
      merchandise_type: selectedType,
      notes: isMoving ? notesForCollection(record, lang) : (record.notes || ''),
    });
    setPhotos(getPhotos(record));
    isFormInitialized.current = true;
    setLoading(false);
  }, [isEditing, isMoving, loadedItem, loadedEntry, allItems, uniqueCustomTypes, navigate, lang]);

  const currentType = formData.merchandise_type === '__custom__'
    ? customType.trim()
    : formData.merchandise_type;
  const missingDetails = getMissingDetails({ ...formData, merchandise_type: currentType });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMultiValueChange = (name, values) => {
    setFormData(prev => ({ ...prev, [name]: values }));
  };

  // The new photos replace the wishlist's; skipping the step keeps the wishlist's.
  const handleMovePhoto = (event) => {
    const files = Array.from(event.target.files ?? [])
      .filter(isImageFile)
      .slice(0, BACKUP_LIMITS.maxPhotosPerRecord);
    event.target.value = '';
    if (files.length === 0) return;
    setPhotos(files);
    setIsPhotoStepDone(true);
  };

  const saveItem = async () => {
    setUnfinishedPromptOpen(false);
    setIsSaving(true);
    try {
      const itemData = {
        ...formData,
        merchandise_type: currentType,
        photos: await preparePhotosForSaving(photos),
        updated_at: new Date()
      };

      // An explicit destination: /edit/:id can be opened directly, where there is no
      // in-app history entry to go back to.
      let destination = exitPath;
      if (isMoving) {
        itemData.created_at = new Date();
        // One transaction, so the entry leaves the wishlist only once the item is saved.
        await db.transaction('rw', db.items, db.wishlist, async () => {
          const newItemId = await db.items.add(itemData);
          await db.wishlist.delete(recordId);
          destination = `/item/${newItemId}`;
        });
      } else if (isEditing) {
        await db.items.update(recordId, itemData);
      } else {
        itemData.created_at = new Date();
        await db.items.add(itemData);
      }

      navigate(destination, returnState ? { replace: true, state: returnState } : { replace: true });
    } catch (error) {
      console.error("Error saving item:", error);
      setNotice({ title: t('errorTitle'), message: t('saveError') });
      setIsSaving(false);
    }
  };

  // Missing details do not block saving. After the user confirms, the item is saved and
  // marked as needing them.
  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSaving) return;
    if (missingDetails.length > 0) {
      setUnfinishedPromptOpen(true);
      return;
    }
    saveItem();
  };

  const handleDelete = async () => {
    setDeletePromptOpen(false);
    setIsSaving(true);
    try {
      await db.items.delete(recordId);
      navigate('/');
    } catch (error) {
      console.error("Error deleting item:", error);
      setNotice({ title: t('errorTitle'), message: t('deleteError') });
      setIsSaving(false);
    }
  };

  if (loading) return <div className="loading">{t('loading')}</div>;

  let title = t('newItem');
  if (isMoving) title = t('moveToCollection');
  else if (isEditing) title = t('editItem');

  const header = (
    <header className="page-header">
      <button className="back-btn" onClick={leave} aria-label={t('cancel')} disabled={isSaving}>
        <ArrowLeft size={24} />
      </button>
      <h2>{title}</h2>
      {isEditing && (
        <button className="delete-btn" onClick={() => setDeletePromptOpen(true)} aria-label={t('deleteConfirm')} disabled={isSaving}>
          <Trash2 size={24} color="var(--danger)" />
        </button>
      )}
    </header>
  );

  if (!isPhotoStepDone) {
    const separator = lang === 'en' ? ', ' : '、';
    return (
      <div className="form-page">
        {header}
        <section className="move-photo-step glass-panel" aria-labelledby="move-photo-title">
          <h3 id="move-photo-title">{getWishlistTitle(movingEntry, separator) || t('untitledEntry')}</h3>
          <p>{t('movePhotoPrompt')}</p>
          {wishlistPhotoUrl && (
            <img className="move-wishlist-photo" src={wishlistPhotoUrl} alt={t('moveWishlistPhoto')} />
          )}
          {wishlistPhotoCount > 1 && <p>{t('photoCount', { count: wishlistPhotoCount })}</p>}
          <input
            type="file"
            accept="image/*"
            multiple
            aria-label={t('movePhotoFile')}
            className="sr-only"
            ref={movePhotoInputRef}
            onChange={handleMovePhoto}
          />
          <div className="move-photo-actions">
            <button type="button" className="btn btn-primary" onClick={() => movePhotoInputRef.current?.click()}>
              <Camera size={20} aria-hidden="true" />
              {t('moveTakePhoto')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setIsPhotoStepDone(true)}>
              {t(wishlistPhotoCount > 0 ? 'moveSkipUseWishlistPhoto' : 'moveSkip')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  let submitLabel = t('addItem');
  if (isSaving) submitLabel = t('saving');
  else if (isMoving) submitLabel = t('moveToCollection');
  else if (isEditing) submitLabel = t('saveChanges');

  return (
    <div className="form-page">
      {header}

      <form onSubmit={handleSubmit} className="item-form">
        <PhotoListEditor photos={photos} onChange={setPhotos} />
        {isMoving && <p className="move-form-hint">{t('moveFormHint')}</p>}
        {isEditing && missingDetails.length > 0 && (
          <p className="move-form-hint">
            {t('itemNeedsDetails', { fields: describeMissingDetails(missingDetails, t, lang) })}
          </p>
        )}

        <div className="form-group">
          <label htmlFor="series">{t('seriesFranchise')}</label>
          <MultiSelectCombobox
            id="series"
            label={t('seriesFranchise')}
            value={formData.series}
            options={uniqueSeries}
            onChange={(values) => handleMultiValueChange('series', values)}
            placeholder={t('seriesPlaceholder')}
            addLabel={t('addMultiValue')}
            removeLabel={t('removeMultiValue')}
          />
        </div>

        <div className="form-group">
          <label htmlFor="character">{t('character')}</label>
          <MultiSelectCombobox
            id="character"
            label={t('character')}
            value={formData.character}
            options={uniqueCharacters}
            onChange={(values) => handleMultiValueChange('character', values)}
            placeholder={t('characterPlaceholder')}
            addLabel={t('addMultiValue')}
            removeLabel={t('removeMultiValue')}
          />
        </div>

        <div className="form-group">
          <label htmlFor="merchandise_type">{t('merchandiseType')}</label>
          <div className="select-wrapper glass-panel">
            <select
              id="merchandise_type"
              name="merchandise_type"
              value={formData.merchandise_type}
              onChange={handleChange}
            >
              <option value="" disabled>---</option>
              {DEFAULT_TYPES.map(type => (
                 <option key={type} value={type}>{lang === 'en' ? type : (t(type) !== type ? t(type) : type)}</option>
              ))}
              {uniqueCustomTypes.map(type => (
                 <option key={type} value={type}>{type}</option>
              ))}
              <option value="__custom__">➕ {t('addSelfDefinedType')}</option>
            </select>
          </div>

          {formData.merchandise_type === '__custom__' && (
            <input
              type="text"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder={t('typeToSearch')}
              style={{marginTop: '0.75rem'}}
              autoFocus
            />
          )}
        </div>

        <div className="form-group">
          <label htmlFor="notes">{t('notesOptional')}</label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder={t('notesPlaceholder')}
            rows="3"
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={leave} disabled={isSaving}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
             {isSaving && <span className="loading-spinner"></span>}
             {!isSaving && (isMoving ? <PackageCheck size={20} /> : <Save size={20} />)}
             {submitLabel}
          </button>
        </div>
      </form>

      <AppDialog
        open={unfinishedPromptOpen}
        title={t('saveUnfinishedTitle')}
        message={t('saveUnfinishedMessage', { fields: describeMissingDetails(missingDetails, t, lang) })}
        confirmLabel={t('saveUnfinished')}
        cancelLabel={t('keepEditing')}
        onConfirm={saveItem}
        onCancel={() => setUnfinishedPromptOpen(false)}
      />
      <AppDialog
        open={deletePromptOpen}
        title={t('deleteTitle')}
        message={t('deleteConfirm')}
        confirmLabel={t('continue')}
        cancelLabel={t('cancel')}
        onConfirm={handleDelete}
        onCancel={() => setDeletePromptOpen(false)}
        destructive
      />
      <AppDialog
        open={Boolean(notice)}
        title={notice?.title}
        message={notice?.message}
        confirmLabel={t('close')}
        onConfirm={() => setNotice(null)}
      />
    </div>
  );
}
