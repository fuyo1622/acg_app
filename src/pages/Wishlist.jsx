import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Filter, Heart, Images, Plus, Search } from 'lucide-react';
import { db } from '../services/db';
import { useLanguage } from '../contexts/LanguageContext';
import AppDialog from '../components/AppDialog';
import AppFooter from '../components/AppFooter';
import AppHeader from '../components/AppHeader';
import Pagination from '../components/Pagination';
import WishlistCard from '../components/WishlistCard';
import {
  COLLECTION_PAGE_SIZE,
  DEFAULT_TYPES,
  QUICK_ADD_CONCURRENCY,
  QUICK_ADD_LIMIT,
  WISHLIST_PRIORITIES,
  WISHLIST_PRIORITY_LABELS,
  WISHLIST_STATUSES,
  WISHLIST_STATUS_LABELS,
} from '../utils/constants';
import { mapWithConcurrency } from '../utils/backupUtils';
import { compressImage } from '../utils/imageUtils';
import { createWishlistEntry, filterWishlist, readPreferredCurrency } from '../utils/wishlistUtils';
import './Home.css';
import './Wishlist.css';

const SORT_OPTIONS = [
  { value: 'newest', labelKey: 'sortNewest' },
  { value: 'deadline', labelKey: 'sortDeadline' },
  { value: 'priority', labelKey: 'sortPriority' },
];

export default function Wishlist() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [notice, setNotice] = useState(null);
  const quickAddInputRef = useRef(null);

  const entries = useLiveQuery(
    () => db.wishlist.orderBy('created_at').reverse().toArray(),
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterPriority, sortOrder]);

  const getTypeLabel = useCallback(
    (type) => (DEFAULT_TYPES.includes(type) ? t(type) : type),
    [t],
  );

  const filteredEntries = useMemo(
    () => filterWishlist({
      entries,
      searchTerm,
      filterStatus,
      filterPriority,
      sortOrder,
      getTypeLabel,
    }),
    [entries, searchTerm, filterStatus, filterPriority, sortOrder, getTypeLabel],
  );
  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / COLLECTION_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageStart = (safeCurrentPage - 1) * COLLECTION_PAGE_SIZE;
  const visibleEntries = filteredEntries.slice(pageStart, pageStart + COLLECTION_PAGE_SIZE);

  // Each screenshot becomes its own entry with nothing else filled in, so a batch can be
  // captured quickly in a shop or online and completed later.
  const handleQuickAdd = async (event) => {
    const chosenFiles = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (chosenFiles.length === 0) return;

    const images = chosenFiles.filter(file => file.type.startsWith('image/'));
    if (images.length === 0) {
      setNotice({ title: t('errorTitle'), message: t('quickAddNoImages') });
      return;
    }
    if (images.length > QUICK_ADD_LIMIT) {
      setNotice({ title: t('errorTitle'), message: t('quickAddTooMany', { max: QUICK_ADD_LIMIT }) });
      return;
    }

    setIsAdding(true);
    try {
      const photos = await mapWithConcurrency(images, QUICK_ADD_CONCURRENCY, compressImage);
      const now = Date.now();
      const currency = readPreferredCurrency();

      // Earlier picks get later timestamps, so the batch reads in picking order under
      // "newest first".
      const newEntries = photos.map((photo, index) => {
        const createdAt = new Date(now - index);
        return createWishlistEntry({ photo, currency, created_at: createdAt, updated_at: createdAt });
      });

      // An explicit transaction saves the whole batch or none of it. It also avoids a
      // Dexie 4.4 live-query cache bug: when an auto-keyed add fails outside one, the next
      // wishlist query throws during render and the page falls into the error boundary.
      await db.transaction('rw', db.wishlist, () => db.wishlist.bulkAdd(newEntries));
      setNotice({ title: t('successTitle'), message: t('quickAddDone', { count: photos.length }) });
    } catch (error) {
      console.error(error);
      setNotice({ title: t('errorTitle'), message: t('saveError') });
    } finally {
      setIsAdding(false);
    }
  };

  const isEmpty = entries !== undefined && entries.length === 0;

  return (
    <div className="home-page wishlist-page">
      <AppHeader title={t('wishlist')} storageRefreshKey={entries?.length}>
        <div className="search-bar glass-panel">
          <div className="search-input-row">
            <Search className="search-icon" size={20} aria-hidden="true" />
            <input
              type="search"
              aria-label={t('wishlistSearchLabel')}
              placeholder={t('wishlistSearchPlaceholder')}
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="filter-wrapper">
            <Filter className="filter-icon" size={20} aria-hidden="true" />
            <select
              aria-label={t('filterStatusLabel')}
              value={filterStatus}
              onChange={event => setFilterStatus(event.target.value)}
              className="filter-select"
            >
              <option value="all">{t('allStatuses')}</option>
              {WISHLIST_STATUSES.map(status => (
                <option key={status} value={status}>{t(WISHLIST_STATUS_LABELS[status])}</option>
              ))}
            </select>

            <select
              aria-label={t('filterPriorityLabel')}
              value={filterPriority}
              onChange={event => setFilterPriority(event.target.value)}
              className="filter-select"
            >
              <option value="all">{t('allPriorities')}</option>
              {WISHLIST_PRIORITIES.map(priority => (
                <option key={priority} value={priority}>{t(WISHLIST_PRIORITY_LABELS[priority])}</option>
              ))}
            </select>

            <select
              aria-label={t('sortLabel')}
              value={sortOrder}
              onChange={event => setSortOrder(event.target.value)}
              className="filter-select"
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{t(option.labelKey)}</option>
              ))}
            </select>
          </div>
        </div>
      </AppHeader>

      <main>
        <div className="wishlist-toolbar">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => quickAddInputRef.current?.click()}
            disabled={isAdding}
          >
            <Images size={18} aria-hidden="true" />
            {isAdding ? t('quickAddProgress') : t('quickAdd')}
          </button>
          <p>{t('quickAddHint')}</p>
          <input
            type="file"
            accept="image/*"
            multiple
            aria-label={t('quickAddFiles')}
            className="sr-only"
            ref={quickAddInputRef}
            onChange={handleQuickAdd}
          />
        </div>

        <div className="gallery-grid">
          {entries === undefined ? (
            <div className="loading">{t('loadingWishlist')}</div>
          ) : filteredEntries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon glass-panel">
                {isEmpty
                  ? <Heart size={48} color="var(--accent-secondary)" aria-hidden="true" />
                  : <Search size={48} color="var(--accent-primary)" aria-hidden="true" />}
              </div>
              <h2>{t(isEmpty ? 'wishlistEmpty' : 'noEntriesFound')}</h2>
              <p>{t(isEmpty ? 'wishlistEmptyHint' : 'tryAdjustingWishlist')}</p>
            </div>
          ) : (
            visibleEntries.map(entry => <WishlistCard key={entry.id} entry={entry} />)
          )}
        </div>

        {filteredEntries.length > 0 && (
          <Pagination
            page={safeCurrentPage}
            pageCount={pageCount}
            start={pageStart + 1}
            end={Math.min(pageStart + COLLECTION_PAGE_SIZE, filteredEntries.length)}
            total={filteredEntries.length}
            onPageChange={setCurrentPage}
          />
        )}
      </main>

      <AppFooter />

      <button
        type="button"
        className="fab"
        onClick={() => navigate('/wishlist/add')}
        aria-label={t('addWishlistEntry')}
      >
        <Plus size={28} aria-hidden="true" />
      </button>

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
