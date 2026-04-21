import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import ItemCard from '../components/ItemCard';
import { DEFAULT_TYPES } from '../utils/constants';
import { filterItems, getUniqueValues } from '../utils/filterUtils';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const { lang, setLang, t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSeries, setFilterSeries] = useState('all');
  const [filterCharacter, setFilterCharacter] = useState('all');

  // Fetch items from IndexedDB
  const items = useLiveQuery(
    () => db.items.orderBy('created_at').reverse().toArray()
  );

  const { uniqueSeries, uniqueCharacters, uniqueCustomTypes } = getUniqueValues(items);
  const filteredItems = filterItems({ items, searchTerm, filterType, filterSeries, filterCharacter });

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
        </div>
        
        <div className="search-bar glass-panel" style={{ flexWrap: 'wrap' }}>
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
