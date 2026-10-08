import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import { db } from '../services/db';
import AppDialog from '../components/AppDialog';
import ImageUploader from '../components/ImageUploader';
import LinkListEditor from '../components/LinkListEditor';
import MultiSelectCombobox from '../components/MultiSelectCombobox';
import { useLanguage } from '../contexts/LanguageContext';
import {
  BACKUP_LIMITS,
  DEFAULT_TYPES,
  WISHLIST_CURRENCIES,
  WISHLIST_LIMITS,
  WISHLIST_PRIORITIES,
  WISHLIST_PRIORITY_LABELS,
  WISHLIST_STATUSES,
  WISHLIST_STATUS_LABELS,
} from '../utils/constants';
import { getUniqueValues } from '../utils/filterUtils';
import { compressImage } from '../utils/imageUtils';
import { isSameValue, toValueArray } from '../utils/valueUtils';
import {
  createLinkRow,
  prepareWishlistEntry,
  readPreferredCurrency,
  savePreferredCurrency,
} from '../utils/wishlistUtils';
import './AddEditItem.css';
import './Wishlist.css';

function emptyForm() {
  return {
    name: '',
    series: [],
    character: [],
    merchandise_type: '',
    price: '',
    currency: readPreferredCurrency(),
    shop: '',
    order_deadline: '',
    release: '',
    priority: 'medium',
    status: 'want',
    notes: '',
  };
}

export default function AddEditWishlistEntry() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useLanguage();
  const isEditing = !!id;

  const [formData, setFormData] = useState(emptyForm);
  const [linkRows, setLinkRows] = useState(() => [createLinkRow()]);
  const [photo, setPhoto] = useState(null);
  const [customType, setCustomType] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);

  const entryId = Number.parseInt(id, 10);
  const exitPath = isEditing ? `/wishlist/item/${id}` : '/wishlist';

  // Suggestions come from both lists, so an entry can reuse the collection's spelling.
  const collectionItems = useLiveQuery(() => db.items.toArray());
  const wishlistEntries = useLiveQuery(() => db.wishlist.toArray());
  const suggestionsLoaded = collectionItems !== undefined && wishlistEntries !== undefined;
  const { uniqueSeries, uniqueCharacters, uniqueCustomTypes } = useMemo(
    () => getUniqueValues([...(collectionItems ?? []), ...(wishlistEntries ?? [])]),
    [collectionItems, wishlistEntries],
  );

  // The wrapper object separates "still loading" from "not found". An id that is not a
  // number is not a valid IndexedDB key, so it counts as not found instead of throwing.
  const loadedEntry = useLiveQuery(
    async () => {
      if (!isEditing) return null;
      if (!Number.isInteger(entryId)) return { entry: null };
      return { entry: (await db.wishlist.get(entryId)) ?? null };
    },
    [entryId, isEditing],
  );

  // Fill the form once, and only after the type list has loaded. Classifying the type
  // against an empty list would push an already-listed type into the free-text box.
  const isFormInitialized = useRef(false);
  useEffect(() => {
    if (!isEditing || isFormInitialized.current) return;
    if (!loadedEntry || !suggestionsLoaded) return;

    const { entry } = loadedEntry;
    if (!entry) {
      navigate('/wishlist', { replace: true });
      return;
    }

    let selectedType = entry.merchandise_type || '';
    const listedType = [...DEFAULT_TYPES, ...uniqueCustomTypes]
      .find(type => isSameValue(type, selectedType));

    if (listedType) {
      selectedType = listedType;
    } else if (selectedType) {
      setCustomType(selectedType);
      selectedType = '__custom__';
    }

    setFormData({
      name: entry.name || '',
      series: toValueArray(entry.series),
      character: toValueArray(entry.character),
      merchandise_type: selectedType,
      price: typeof entry.price === 'number' ? String(entry.price) : '',
      currency: entry.currency || readPreferredCurrency(),
      shop: entry.shop || '',
      order_deadline: entry.order_deadline || '',
      release: entry.release || '',
      priority: entry.priority || 'medium',
      status: entry.status || 'want',
      notes: entry.notes || '',
    });
    setLinkRows(entry.links?.length ? entry.links.map(link => createLinkRow(link)) : [createLinkRow()]);
    setPhoto(entry.photo ?? null);
    isFormInitialized.current = true;
    setLoading(false);
  }, [isEditing, loadedEntry, suggestionsLoaded, uniqueCustomTypes, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMultiValueChange = (name, values) => {
    setFormData(prev => ({ ...prev, [name]: values }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSaving) return;

    const merchandiseType = formData.merchandise_type === '__custom__'
      ? customType
      : formData.merchandise_type;
    const { entry, errorKey, errorValues } = prepareWishlistEntry({
      ...formData,
      merchandise_type: merchandiseType,
      links: linkRows,
      photo,
    });

    if (errorKey) {
      setNotice({ title: t('errorTitle'), message: t(errorKey, errorValues) });
      return;
    }

    setIsSaving(true);
    try {
      const processedPhoto = photo instanceof File ? await compressImage(photo) : photo;
      const entryData = { ...entry, photo: processedPhoto, updated_at: new Date() };

      // Writing inside an explicit transaction avoids a Dexie 4.4 live-query cache bug: a
      // failed auto-keyed add outside one makes the next wishlist query throw on render.
      await db.transaction('rw', db.wishlist, async () => {
        if (isEditing) {
          await db.wishlist.update(entryId, entryData);
        } else {
          entryData.created_at = new Date();
          await db.wishlist.add(entryData);
        }
      });
      if (entry.price !== null) savePreferredCurrency(entry.currency);

      // An explicit destination: /wishlist/edit/:id can be opened directly, where there
      // is no in-app history entry to go back to.
      navigate(exitPath, { replace: true });
    } catch (error) {
      console.error('Error saving wishlist entry:', error);
      setNotice({ title: t('errorTitle'), message: t('saveError') });
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeletePromptOpen(false);
    setIsSaving(true);
    try {
      await db.wishlist.delete(entryId);
      navigate('/wishlist', { replace: true });
    } catch (error) {
      console.error('Error deleting wishlist entry:', error);
      setNotice({ title: t('errorTitle'), message: t('deleteError') });
      setIsSaving(false);
    }
  };

  if (loading) return <div className="loading">{t('loading')}</div>;

  // An entry restored from a backup may use a currency the picker does not list.
  const currencyOptions = WISHLIST_CURRENCIES.includes(formData.currency)
    ? WISHLIST_CURRENCIES
    : [...WISHLIST_CURRENCIES, formData.currency];

  return (
    <div className="form-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(exitPath)} aria-label={t('cancel')} disabled={isSaving}>
          <ArrowLeft size={24} />
        </button>
        <h2>{isEditing ? t('editWishlistEntry') : t('newWishlistEntry')}</h2>
        {isEditing && (
          <button
            className="delete-btn"
            onClick={() => setDeletePromptOpen(true)}
            aria-label={t('deleteWishlistConfirm')}
            disabled={isSaving}
          >
            <Trash2 size={24} color="var(--danger)" />
          </button>
        )}
      </header>

      <form onSubmit={handleSubmit} className="item-form">
        <ImageUploader defaultImage={photo} onImageSelected={setPhoto} />
        <p className="form-hint">{t('wishlistFormHint')}</p>

        <div className="form-group">
          <label htmlFor="wishlist-name">{t('entryName')}</label>
          <input
            id="wishlist-name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            placeholder={t('entryNamePlaceholder')}
            maxLength={WISHLIST_LIMITS.maxNameLength}
          />
        </div>

        <LinkListEditor rows={linkRows} onChange={setLinkRows} />

        <div className="form-row price-row">
          <div className="form-group">
            <label htmlFor="wishlist-price">{t('price')}</label>
            <input
              id="wishlist-price"
              name="price"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={formData.price}
              onChange={handleChange}
              placeholder="0"
            />
          </div>
          <div className="form-group">
            <label htmlFor="wishlist-currency">{t('currency')}</label>
            <div className="select-wrapper glass-panel">
              <select id="wishlist-currency" name="currency" value={formData.currency} onChange={handleChange}>
                {currencyOptions.map(code => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="wishlist-shop">{t('shop')}</label>
          <input
            id="wishlist-shop"
            name="shop"
            type="text"
            value={formData.shop}
            onChange={handleChange}
            placeholder={t('shopPlaceholder')}
            maxLength={WISHLIST_LIMITS.maxShopLength}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="wishlist-deadline">{t('orderDeadline')}</label>
            <input
              id="wishlist-deadline"
              name="order_deadline"
              type="date"
              value={formData.order_deadline}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="wishlist-release">{t('release')}</label>
            <input
              id="wishlist-release"
              name="release"
              type="text"
              value={formData.release}
              onChange={handleChange}
              placeholder={t('releasePlaceholder')}
              maxLength={WISHLIST_LIMITS.maxReleaseLength}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="wishlist-status">{t('status')}</label>
            <div className="select-wrapper glass-panel">
              <select id="wishlist-status" name="status" value={formData.status} onChange={handleChange}>
                {WISHLIST_STATUSES.map(status => (
                  <option key={status} value={status}>{t(WISHLIST_STATUS_LABELS[status])}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="wishlist-priority">{t('priority')}</label>
            <div className="select-wrapper glass-panel">
              <select id="wishlist-priority" name="priority" value={formData.priority} onChange={handleChange}>
                {WISHLIST_PRIORITIES.map(priority => (
                  <option key={priority} value={priority}>{t(WISHLIST_PRIORITY_LABELS[priority])}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

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
              <option value="">{t('noType')}</option>
              {DEFAULT_TYPES.map(type => (
                <option key={type} value={type}>{t(type)}</option>
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
              aria-label={t('addSelfDefinedType')}
              value={customType}
              onChange={(event) => setCustomType(event.target.value)}
              placeholder={t('typeToSearch')}
              maxLength={BACKUP_LIMITS.maxTypeLength}
              className="custom-type-input"
              autoFocus
            />
          )}
        </div>

        <div className="form-group">
          <label htmlFor="wishlist-notes">{t('notes')}</label>
          <textarea
            id="wishlist-notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder={t('notesPlaceholder')}
            maxLength={BACKUP_LIMITS.maxNotesLength}
            rows="3"
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(exitPath)} disabled={isSaving}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? <span className="loading-spinner"></span> : <Save size={20} />}
            {isSaving ? t('saving') : (isEditing ? t('saveChanges') : t('addWishlistEntry'))}
          </button>
        </div>
      </form>

      <AppDialog
        open={deletePromptOpen}
        title={t('deleteWishlistTitle')}
        message={t('deleteWishlistConfirm')}
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
