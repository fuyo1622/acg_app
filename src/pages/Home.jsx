import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Filter, Images, Plus, Search } from 'lucide-react';
import { db } from '../services/db';
import { useLanguage } from '../contexts/LanguageContext';
import AppDialog from '../components/AppDialog';
import AppFooter from '../components/AppFooter';
import AppHeader from '../components/AppHeader';
import ItemCard from '../components/ItemCard';
import Pagination from '../components/Pagination';
import { useImportedNotice } from '../hooks/useImportedNotice';
import { handOffAlbumFiles } from '../utils/albumHandoff';
import { COLLECTION_PAGE_SIZE, DEFAULT_TYPES } from '../utils/constants';
import { filterItems, getUniqueValues, resolveFilterValue } from '../utils/filterUtils';
import { needsDetails } from '../utils/validationUtils';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSeries, setFilterSeries] = useState('all');
  const [filterCharacter, setFilterCharacter] = useState('all');
  const [onlyNeedingDetails, setOnlyNeedingDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [importedCount, closeImportedNotice] = useImportedNotice();
  const albumInputRef = useRef(null);

  const items = useLiveQuery(
    () => db.items.orderBy('created_at').reverse().toArray(),
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterSeries, filterCharacter, onlyNeedingDetails]);

  const needingDetailsCount = useMemo(() => (items ?? []).filter(needsDetails).length, [items]);

  // Once the last item is completed, the filter would leave an empty gallery.
  useEffect(() => {
    if (needingDetailsCount === 0) setOnlyNeedingDetails(false);
  }, [needingDetailsCount]);

  // The picker opens here, on the tap; the import page receives the chosen files.
  const handleAlbumPick = (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    handOffAlbumFiles(files);
    navigate('/import');
  };

  const getTypeLabel = useCallback(
    (type) => (DEFAULT_TYPES.includes(type) ? t(type) : type),
    [t],
  );

  const { uniqueSeries, uniqueCharacters, uniqueCustomTypes } = useMemo(
    () => getUniqueValues(items),
    [items],
  );

  // A filter can outlive the value it points at, for example after the last item using
  // a series is deleted or re-spelled. Re-point it instead of showing an empty gallery.
  useEffect(() => {
    if (!items) return;
    const typeOptions = [...DEFAULT_TYPES, ...uniqueCustomTypes];
    setFilterType(current => resolveFilterValue(typeOptions, current));
    setFilterSeries(current => resolveFilterValue(uniqueSeries, current));
    setFilterCharacter(current => resolveFilterValue(uniqueCharacters, current));
  }, [items, uniqueSeries, uniqueCharacters, uniqueCustomTypes]);

  const filteredItems = useMemo(
    () => {
      const matches = filterItems({
        items,
        searchTerm,
        filterType,
        filterSeries,
        filterCharacter,
        getTypeLabel,
      });
      return onlyNeedingDetails ? matches.filter(needsDetails) : matches;
    },
    [items, searchTerm, filterType, filterSeries, filterCharacter, getTypeLabel, onlyNeedingDetails],
  );
  // The whole filtered list, not only this page, so swiping on an item page goes past it.
  const itemOrder = useMemo(() => filteredItems.map(item => item.id), [filteredItems]);
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / COLLECTION_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageStart = (safeCurrentPage - 1) * COLLECTION_PAGE_SIZE;
  const visibleItems = filteredItems.slice(pageStart, pageStart + COLLECTION_PAGE_SIZE);

  return (
    <div className="home-page">
      <AppHeader title={t('myCollection')} storageRefreshKey={items?.length}>
        <div className="search-bar glass-panel">
          <div className="search-input-row">
            <Search className="search-icon" size={20} aria-hidden="true" />
            <input
              type="search"
              aria-label={t('searchLabel')}
              placeholder={t('searchPlaceholder')}
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="filter-wrapper">
            <Filter className="filter-icon" size={20} aria-hidden="true" />
            <select
              aria-label={t('filterTypeLabel')}
              value={filterType}
              onChange={event => setFilterType(event.target.value)}
              className="filter-select"
            >
              <option value="all">{t('allTypes')}</option>
              {DEFAULT_TYPES.map(type => (
                <option key={type} value={type}>{t(type)}</option>
              ))}
              {uniqueCustomTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <select
              aria-label={t('filterSeriesLabel')}
              value={filterSeries}
              onChange={event => setFilterSeries(event.target.value)}
              className="filter-select"
            >
              <option value="all">{t('allSeries')}</option>
              {uniqueSeries.map(series => (
                <option key={series} value={series}>{series}</option>
              ))}
            </select>

            <select
              aria-label={t('filterCharacterLabel')}
              value={filterCharacter}
              onChange={event => setFilterCharacter(event.target.value)}
              className="filter-select"
            >
              <option value="all">{t('allCharacters')}</option>
              {uniqueCharacters.map(character => (
                <option key={character} value={character}>{character}</option>
              ))}
            </select>
          </div>
        </div>
      </AppHeader>

      <main>
        <div className="list-toolbar">
          <button type="button" className="btn btn-secondary" onClick={() => albumInputRef.current?.click()}>
            <Images size={18} aria-hidden="true" />
            {t('importAlbum')}
          </button>
          <p>{t('importAlbumHint')}</p>
          <input
            type="file"
            accept="image/*"
            multiple
            aria-label={t('albumPhotos')}
            className="sr-only"
            ref={albumInputRef}
            onChange={handleAlbumPick}
          />
        </div>

        {needingDetailsCount > 0 && (
          <div className="needs-details-banner glass-panel">
            <span>{t('needsDetailsCount', { count: needingDetailsCount })}</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setOnlyNeedingDetails(only => !only)}
            >
              {t(onlyNeedingDetails ? 'showAllItems' : 'showNeedsDetails')}
            </button>
          </div>
        )}

        <div className="gallery-grid">
          {items === undefined ? (
            <div className="loading">{t('loadingCollection')}</div>
          ) : filteredItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon glass-panel">
                <Search size={48} color="var(--accent-primary)" aria-hidden="true" />
              </div>
              <h2>{t('noItemsFound')}</h2>
              <p>{t('tryAdjusting')}</p>
            </div>
          ) : (
            visibleItems.map(item => <ItemCard key={item.id} item={item} order={itemOrder} />)
          )}
        </div>

        {filteredItems.length > 0 && (
          <Pagination
            page={safeCurrentPage}
            pageCount={pageCount}
            start={pageStart + 1}
            end={Math.min(pageStart + COLLECTION_PAGE_SIZE, filteredItems.length)}
            total={filteredItems.length}
            onPageChange={setCurrentPage}
          />
        )}
      </main>

      <AppFooter />

      <button type="button" className="fab" onClick={() => navigate('/add')} aria-label={t('addItem')}>
        <Plus size={28} aria-hidden="true" />
      </button>

      <AppDialog
        open={importedCount !== null}
        title={t('successTitle')}
        message={t('albumImportDone', { count: importedCount ?? 0 })}
        confirmLabel={t('close')}
        onConfirm={closeImportedNotice}
      />
    </div>
  );
}
