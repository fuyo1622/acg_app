import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import ImageUploader from '../components/ImageUploader';
import MultiSelectCombobox from '../components/MultiSelectCombobox';
import AppDialog from '../components/AppDialog';
import { useLanguage } from '../contexts/LanguageContext';
import { DEFAULT_TYPES } from '../utils/constants';
import { validateItem } from '../utils/validationUtils';
import { getUniqueValues } from '../utils/filterUtils';
import { compressImage } from '../utils/imageUtils';
import { toValueArray } from '../utils/valueUtils';
import './AddEditItem.css';

export default function AddEditItem() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    series: [],
    character: [],
    merchandise_type: '', // Empty means nothing selected yet
    notes: '',
  });
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(isEditing);
  const [isSaving, setIsSaving] = useState(false);
  const [customType, setCustomType] = useState('');
  const [notice, setNotice] = useState(null);
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);

  // Fetch all items for autocomplete
  const allItems = useLiveQuery(() => db.items.toArray());
  const { uniqueSeries, uniqueCharacters, uniqueCustomTypes } = getUniqueValues(allItems);

  // Fetch item if editing
  useLiveQuery(async () => {
    if (isEditing) {
      const item = await db.items.get(parseInt(id));
      if (item) {
        let mType = item.merchandise_type;
        let isCustomUnlisted = mType && !DEFAULT_TYPES.includes(mType) && !uniqueCustomTypes.includes(mType);
        
        if (isCustomUnlisted) {
           setCustomType(mType);
           mType = '__custom__';
        }

        setFormData({
          series: toValueArray(item.series),
          character: toValueArray(item.character),
          merchandise_type: mType,
          notes: item.notes || '',
        });
        setPhoto(item.photo);
      } else {
        navigate('/'); // Item not found
      }
      setLoading(false);
    }
  }, [id, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMultiValueChange = (name, values) => {
    setFormData(prev => ({ ...prev, [name]: values }));
  };

  const handleImageSelected = (file) => {
    setPhoto(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    
    let finalType = formData.merchandise_type;
    if (finalType === '__custom__') {
      finalType = customType.trim();
    }

    const { isValid, errorKey } = validateItem({
      ...formData,
      merchandise_type: finalType
    });

    if (!isValid) {
      setNotice({ title: t('errorTitle'), message: t(errorKey) });
      return;
    }

    setIsSaving(true);
    try {
      let processedPhoto = photo;
      if (photo instanceof File) {
        processedPhoto = await compressImage(photo);
      }

      const itemData = {
        ...formData,
        merchandise_type: finalType,
        photo: processedPhoto,
        updated_at: new Date()
      };

      if (isEditing) {
        await db.items.update(parseInt(id), itemData);
      } else {
        itemData.created_at = new Date();
        await db.items.add(itemData);
      }
      
      navigate(-1); // Go back to previous page
    } catch (error) {
      console.error("Error saving item:", error);
      setNotice({ title: t('errorTitle'), message: t('saveError') });
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeletePromptOpen(false);
    setIsSaving(true);
    try {
      await db.items.delete(parseInt(id));
      navigate('/');
    } catch (error) {
      console.error("Error deleting item:", error);
      setNotice({ title: t('errorTitle'), message: t('deleteError') });
      setIsSaving(false);
    }
  };

  if (loading) return <div className="loading">{t('loading')}</div>;

  return (
    <div className="form-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label={t('cancel')} disabled={isSaving}>
          <ArrowLeft size={24} />
        </button>
        <h2>{isEditing ? t('editItem') : t('newItem')}</h2>
        {isEditing && (
          <button className="delete-btn" onClick={() => setDeletePromptOpen(true)} aria-label={t('deleteConfirm')} disabled={isSaving}>
            <Trash2 size={24} color="var(--danger)" />
          </button>
        )}
      </header>

      <form onSubmit={handleSubmit} className="item-form">
        <ImageUploader defaultImage={photo} onImageSelected={handleImageSelected} />
        
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
              required
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
              required
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
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)} disabled={isSaving}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
             {isSaving ? <span className="loading-spinner"></span> : <Save size={20} />}
             {isSaving ? t('saving') : (isEditing ? t('saveChanges') : t('addItem'))}
          </button>
        </div>
      </form>

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
