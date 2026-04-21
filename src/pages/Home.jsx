import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Globe, Download, Upload } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import ItemCard from '../components/ItemCard';
import { DEFAULT_TYPES, BACKUP_VERSION } from '../utils/constants';
import { filterItems, getUniqueValues } from '../utils/filterUtils';
import { serializeBackupItems, buildBackupPayload, parseBackupText, validateBackupPayload, rehydrateBackupItems, replaceItemsInDb } from '../utils/backupUtils';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const { lang, setLang, t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSeries, setFilterSeries] = useState('all');
  const [filterCharacter, setFilterCharacter] = useState('all');
  
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch items from IndexedDB
  const items = useLiveQuery(
    () => db.items.orderBy('created_at').reverse().toArray()
  );

  const { uniqueSeries, uniqueCharacters, uniqueCustomTypes } = getUniqueValues(items);
  const filteredItems = filterItems({ items, searchTerm, filterType, filterSeries, filterCharacter });

  const handleExport = async () => {
    setIsProcessing(true);
    try {
      const itemsRaw = await db.items.toArray();
      const serialized = await serializeBackupItems(itemsRaw);
      const payload = buildBackupPayload(serialized, BACKUP_VERSION);
      const jsonStr = JSON.stringify(payload);
      
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `acg-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert(t('importError') + ' (Export Failed)');
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const payload = parseBackupText(text);
        validateBackupPayload(payload, BACKUP_VERSION);
        
        if (!window.confirm(t('importWarning'))) {
          throw new Error('User cancelled');
        }

        const hydrated = await rehydrateBackupItems(payload.items);
        await replaceItemsInDb(db, hydrated);
        
        alert(t('importSuccess'));
      } catch (err) {
        if (err.message !== 'User cancelled') {
          console.error(err);
          alert(t('importError'));
        }
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      alert(t('importError'));
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsProcessing(false);
    };
    reader.readAsText(file);
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="flex-between">
          <h1>{t('myCollection')}</h1>
          
          <div className="language-selector select-wrapper glass-panel" style={{ width: 'auto', display: 'flex', alignItems: 'center', padding: '0 0.5rem' }}>
            <Globe size={18} style={{ color: 'var(--text-main)', marginLeft: '0.25rem' }} />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="filter-select"
              style={{ background: 'transparent', color: 'var(--text-main)', border: 'none', cursor: 'pointer', paddingRight: '1rem', paddingLeft: '0.25rem' }}
            >
              <option value="zh-TW">繁體中文</option>
              <option value="en">English</option>
            </select>
          </div>
          
          <div className="backup-actions" style={{ display: 'flex', gap: '0.5rem', marginLeft: '0.5rem' }}>
             <button onClick={handleExport} disabled={isProcessing} className="btn-icon glass-panel" title={t('exportBackup')} style={{ padding: '0.5rem', border: 'none', background: 'var(--bg-card)', cursor: 'pointer', borderRadius: '8px' }}>
               <Download size={18} color="var(--text-main)" />
             </button>
             <button onClick={triggerImport} disabled={isProcessing} className="btn-icon glass-panel" title={t('importBackup')} style={{ padding: '0.5rem', border: 'none', background: 'var(--bg-card)', cursor: 'pointer', borderRadius: '8px' }}>
               <Upload size={18} color="var(--text-main)" />
             </button>
             <input type="file" accept=".json" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImport} />
          </div>
        </div>
        
        <div className="search-bar glass-panel" style={{ flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', flex: '1 1 100%', alignItems: 'center', marginBottom: filterSeries !== 'all' || filterCharacter !== 'all' || filterType !== 'all' ? '0.5rem' : '0' }}>
            <Search className="search-icon" size={20} />
            <input 
              type="text" 
              placeholder={t('searchPlaceholder')} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ flex: 1, border: 'none', background: 'transparent', padding: '0.5rem', outline: 'none', color: 'var(--text-main)' }}
            />
          </div>
          
          <div className="filter-wrapper" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', width: '100%', borderLeft: 'none', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
             <Filter className="filter-icon" size={20} style={{ alignSelf: 'center' }} />
             
             <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                className="filter-select"
             >
                <option value="all">{t('allTypes')}</option>
                {DEFAULT_TYPES.map(type => (
                   <option key={type} value={type}>{lang === 'en' ? type : (t(type) !== type ? t(type) : type)}</option>
                ))}
                {uniqueCustomTypes.map(type => (
                   <option key={type} value={type}>{type}</option>
                ))}
             </select>

             <select 
                value={filterSeries} 
                onChange={(e) => setFilterSeries(e.target.value)}
                className="filter-select"
             >
                <option value="all">{t('allSeries')}</option>
                {uniqueSeries.map(series => (
                   <option key={series} value={series}>{series}</option>
                ))}
             </select>

             <select 
                value={filterCharacter} 
                onChange={(e) => setFilterCharacter(e.target.value)}
                className="filter-select"
             >
                <option value="all">{t('allCharacters')}</option>
                {uniqueCharacters.map(char => (
                   <option key={char} value={char}>{char}</option>
                ))}
             </select>
          </div>
        </div>
      </header>

      <main className="gallery-grid">
        {items === undefined ? (
          <div className="loading">{t('loadingCollection')}</div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
             <div className="empty-icon glass-panel">
                <Search size={48} color="var(--accent-primary)" />
             </div>
             <h2>{t('noItemsFound')}</h2>
             <p>{t('tryAdjusting')}</p>
          </div>
        ) : (
          filteredItems.map(item => (
             <ItemCard key={item.id} item={item} />
          ))
        )}
      </main>

      <button className="fab" onClick={() => navigate('/add')} aria-label={t('addItem')}>
        <Plus size={28} />
      </button>
    </div>
  );
}
