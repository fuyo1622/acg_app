import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
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

  const defaultTypes = ['figure', 'plush', 'acrylic', 'badge', 'apparel', 'poster', 'other'];
  const uniqueCustomTypes = [...new Set(items?.map(i => i.merchandise_type).filter(v => v && !defaultTypes.includes(v)))] || [];
  const uniqueSeries = [...new Set(items?.map(i => i.series).filter(Boolean))] || [];
  const uniqueCharacters = [...new Set(items?.map(i => i.character).filter(Boolean))] || [];

  // Filter items based on search and dropdown
  const filteredItems = items?.filter(item => {
    const matchesSearch = 
      (item.series || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.character || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || item.merchandise_type === filterType;
    const matchesSeries = filterSeries === 'all' || item.series === filterSeries;
    const matchesCharacter = filterCharacter === 'all' || item.character === filterCharacter;
    
    return matchesSearch && matchesType && matchesSeries && matchesCharacter;
  }) || [];

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
                {defaultTypes.map(type => (
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
             <div 
                key={item.id} 
                className="item-card glass-panel"
                onClick={() => navigate(`/item/${item.id}`)}
             >
                <div className="image-container">
                   {item.photo ? (
                      <img src={URL.createObjectURL(item.photo)} alt={item.character || item.series} loading="lazy" />
                   ) : (
                      <div className="no-image">{t('noPhoto')}</div>
                   )}
                   <div className="item-badge">{t(item.merchandise_type)}</div>
                </div>
                <div className="item-info">
                   <h3>{item.character || t('unknownCharacter')}</h3>
                   <p className="series">{item.series || t('unknownSeries')}</p>
                </div>
             </div>
          ))
        )}
      </main>

      <button className="fab" onClick={() => navigate('/add')} aria-label={t('addItem')}>
        <Plus size={28} />
      </button>
    </div>
  );
}
