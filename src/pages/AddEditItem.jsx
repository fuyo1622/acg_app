import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import ImageUploader from '../components/ImageUploader';
import { useLanguage } from '../contexts/LanguageContext';
import { DEFAULT_TYPES } from '../utils/constants';
import { validateItem } from '../utils/validationUtils';
import { getUniqueValues } from '../utils/filterUtils';
import './AddEditItem.css';

export default function AddEditItem() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const isEditing = !!id;

  const [formData, setFormData] = useState({
    series: '',
    character: '',
    merchandise_type: '', // Empty means nothing selected yet
    notes: '',
  });
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(isEditing);
  const [customType, setCustomType] = useState('');

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
          series: item.series,
          character: item.character,
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

  const handleImageSelected = (file) => {
    setPhoto(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let finalType = formData.merchandise_type;
    if (finalType === '__custom__') {
      finalType = customType.trim();
    }

    const { isValid, errorKey } = validateItem({
      ...formData,
      merchandise_type: finalType
    });

    if (!isValid) {
      alert(t(errorKey));
      return;
    }

    try {
      const itemData = {
        ...formData,
        merchandise_type: finalType,
        photo,
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
      alert(t('saveError'));
    }
  };

  const handleDelete = async () => {
    if (window.confirm(t('deleteConfirm'))) {
      try {
        await db.items.delete(parseInt(id));
        navigate('/');
      } catch (error) {
        console.error("Error deleting item:", error);
      }
    }
  };

  if (loading) return <div className="loading">{t('loading')}</div>;

  return (
    <div className="form-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label={t('cancel')}>
          <ArrowLeft size={24} />
        </button>
        <h2>{isEditing ? t('editItem') : t('newItem')}</h2>
        {isEditing && (
          <button className="delete-btn" onClick={handleDelete} aria-label={t('deleteConfirm')}>
            <Trash2 size={24} color="var(--danger)" />
          </button>
        )}
      </header>

      <form onSubmit={handleSubmit} className="item-form">
        <ImageUploader defaultImage={photo} onImageSelected={handleImageSelected} />
        
        <div className="form-group">
          <label htmlFor="series">{t('seriesFranchise')}</label>
          <input 
            type="text" 
            id="series" 
            name="series" 
            list="series-list"
            value={formData.series} 
            onChange={handleChange} 
            placeholder={t('seriesPlaceholder')}
            autoComplete="off"
          />
          <datalist id="series-list">
            {uniqueSeries.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>

        <div className="form-group">
          <label htmlFor="character">{t('character')}</label>
          <input 
            type="text" 
            id="character" 
            name="character" 
            list="character-list"
            value={formData.character} 
            onChange={handleChange} 
            placeholder={t('characterPlaceholder')}
            autoComplete="off"
          />
          <datalist id="character-list">
            {uniqueCharacters.map(c => <option key={c} value={c} />)}
          </datalist>
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
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn btn-primary">
            <Save size={20} />
            {isEditing ? t('saveChanges') : t('addItem')}
          </button>
        </div>
      </form>
    </div>
  );
}
