import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import {
  Download,
  Filter,
  Globe,
  HardDrive,
  Plus,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { db } from '../services/db';
import { useLanguage } from '../contexts/LanguageContext';
import AppDialog from '../components/AppDialog';
import ItemCard from '../components/ItemCard';
import {
  BACKUP_VERSION,
  COLLECTION_PAGE_SIZE,
  DEFAULT_TYPES,
} from '../utils/constants';
import { filterItems, getUniqueValues } from '../utils/filterUtils';
import {
  buildBackupPayload,
  parseBackupText,
  rehydrateBackupItems,
  replaceItemsInDb,
  serializeBackupItems,
  validateBackupFile,
  validateBackupPayload,
} from '../utils/backupUtils';
import {
  formatBytes,
  getStorageStatus,
  isStorageNearCapacity,
  requestPersistentStorage,
} from '../utils/storageUtils';
import { APP_RELEASE_URL, APP_VERSION } from '../utils/version';
import './Home.css';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function createBackup(items) {
  const serialized = await serializeBackupItems(items);
  const payload = buildBackupPayload(serialized, BACKUP_VERSION);
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

function backupFilename(prefix) {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.json`;
}

export default function Home() {
  const navigate = useNavigate();
  const { lang, setLang, t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSeries, setFilterSeries] = useState('all');
  const [filterCharacter, setFilterCharacter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [stagedImport, setStagedImport] = useState(null);
  const [storageStatus, setStorageStatus] = useState(null);
  const fileInputRef = useRef(null);

  const items = useLiveQuery(
    () => db.items.orderBy('created_at').reverse().toArray(),
  );

  useEffect(() => {
    let active = true;
    getStorageStatus()
      .then(status => {
        if (active) setStorageStatus(status);
      })
      .catch(() => {
        if (active) setStorageStatus(null);
      });
    return () => {
      active = false;
    };
  }, [items?.length]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterSeries, filterCharacter]);

  const { uniqueSeries, uniqueCharacters, uniqueCustomTypes } = getUniqueValues(items);
  const filteredItems = filterItems({
    items,
    searchTerm,
    filterType,
    filterSeries,
    filterCharacter,
  });
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / COLLECTION_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, pageCount);
  const pageStart = (safeCurrentPage - 1) * COLLECTION_PAGE_SIZE;
  const visibleItems = filteredItems.slice(pageStart, pageStart + COLLECTION_PAGE_SIZE);

  const showError = (messageKey) => {
    setNotice({ title: t('errorTitle'), message: t(messageKey) });
  };

  const handleExport = async () => {
    setIsProcessing(true);
    try {
      const blob = await createBackup(await db.items.toArray());
      downloadBlob(blob, backupFilename('acg-backup'));
    } catch (error) {
      console.error(error);
      showError('exportError');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      validateBackupFile(file);
      const payload = parseBackupText(await file.text());
      validateBackupPayload(payload, BACKUP_VERSION);

      const currentItems = await db.items.toArray();
      const safetyBackup = currentItems.length > 0
        ? await createBackup(currentItems)
        : null;
      setStagedImport({ payload, safetyBackup });
    } catch (error) {
      console.error(error);
      showError('importError');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsProcessing(false);
    }
  };

  const confirmImport = async () => {
    const importData = stagedImport;
    setStagedImport(null);
    if (!importData) return;

    if (importData.safetyBackup) {
      downloadBlob(
        importData.safetyBackup,
        backupFilename('acg-auto-backup-before-import'),
      );
    }

    setIsProcessing(true);
    try {
      const hydrated = await rehydrateBackupItems(importData.payload.items);
      await replaceItemsInDb(db, hydrated);
      setNotice({ title: t('successTitle'), message: t('importSuccess') });
      setStorageStatus(await getStorageStatus());
    } catch (error) {
      console.error(error);
      showError('importError');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePersistentStorage = async () => {
    try {
      const persistent = await requestPersistentStorage();
      setStorageStatus(await getStorageStatus());
      setNotice({
        title: t(persistent ? 'successTitle' : 'backupTitle'),
        message: t(persistent ? 'persistenceGranted' : 'persistenceDenied'),
      });
    } catch (error) {
      console.error(error);
      setNotice({ title: t('backupTitle'), message: t('persistenceDenied') });
    }
  };

  const storageLocale = lang === 'zh-TW' ? 'zh-TW' : 'en';

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="flex-between home-title-row">
          <h1>{t('myCollection')}</h1>

          <div className="language-selector select-wrapper glass-panel">
            <Globe size={18} aria-hidden="true" />
            <label className="sr-only" htmlFor="language-select">{t('language')}</label>
            <select
              id="language-select"
              aria-label={t('language')}
              value={lang}
              onChange={event => setLang(event.target.value)}
              className="filter-select"
            >
              <option value="zh-TW">繁體中文</option>
              <option value="en">English</option>
            </select>
          </div>

          <div className="backup-actions">
            <button
              type="button"
              onClick={handleExport}
              disabled={isProcessing}
              className="btn-icon glass-panel"
              title={t('exportBackup')}
              aria-label={t('exportBackup')}
            >
              <Download size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="btn-icon glass-panel"
              title={t('importBackup')}
              aria-label={t('importBackup')}
            >
              <Upload size={18} aria-hidden="true" />
            </button>
            <input
              type="file"
              accept="application/json,.json"
              aria-label={t('importFile')}
              className="sr-only"
              ref={fileInputRef}
              onChange={handleImport}
            />
          </div>
        </div>

        {storageStatus?.supported && (
          <section
            className={`storage-status glass-panel ${isStorageNearCapacity(storageStatus) ? 'storage-warning' : ''}`}
            aria-label={t('storageLabel')}
          >
            <HardDrive size={20} aria-hidden="true" />
            <div>
              <strong>{t('storageLabel')}</strong>
              <p>
                {t('storageUsage', {
                  used: formatBytes(storageStatus.usage, storageLocale),
                  quota: formatBytes(storageStatus.quota, storageLocale),
                })}
                {' · '}
                {t(storageStatus.persistent ? 'storagePersistent' : 'storageBestEffort')}
              </p>
              {isStorageNearCapacity(storageStatus) && (
                <p className="storage-warning-text" role="alert">{t('storageWarning')}</p>
              )}
            </div>
            {!storageStatus.persistent && (
              <button type="button" className="btn btn-secondary storage-protect-btn" onClick={handlePersistentStorage}>
                <ShieldCheck size={18} aria-hidden="true" />
                {t('protectStorage')}
              </button>
            )}
          </section>
        )}

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
      </header>

      <main>
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
            visibleItems.map(item => <ItemCard key={item.id} item={item} />)
          )}
        </div>

        {filteredItems.length > 0 && (
          <nav className="pagination" aria-label={t('pageOf', { page: safeCurrentPage, pages: pageCount })}>
            <p>
              {t('showingItems', {
                start: pageStart + 1,
                end: Math.min(pageStart + COLLECTION_PAGE_SIZE, filteredItems.length),
                total: filteredItems.length,
              })}
            </p>
            <div>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
              >
                {t('previousPage')}
              </button>
              <span>{t('pageOf', { page: safeCurrentPage, pages: pageCount })}</span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={safeCurrentPage >= pageCount}
                onClick={() => setCurrentPage(page => Math.min(pageCount, page + 1))}
              >
                {t('nextPage')}
              </button>
            </div>
          </nav>
        )}
      </main>

      <footer className="home-footer">
        <a
          href={APP_RELEASE_URL}
          target="_blank"
          rel="noreferrer"
          aria-label={t('versionLabel', { version: APP_VERSION })}
        >
          v{APP_VERSION}
        </a>
        <span aria-hidden="true">·</span>
        <Link to="/guide">{t('usageGuide')}</Link>
        <span aria-hidden="true">·</span>
        <a href="https://tally.so/r/KYNy7M" target="_blank" rel="noreferrer">
          {t('sendFeedback')}
        </a>
        <span aria-hidden="true">·</span>
        <Link to="/privacy">{t('privacyPolicy')}</Link>
        <span aria-hidden="true">·</span>
        <a href={`${import.meta.env.BASE_URL}third-party-notices.txt`}>{t('thirdPartyNotices')}</a>
      </footer>

      <button type="button" className="fab" onClick={() => navigate('/add')} aria-label={t('addItem')}>
        <Plus size={28} aria-hidden="true" />
      </button>

      <AppDialog
        open={Boolean(stagedImport)}
        title={t('importBackup')}
        message={<><p>{t('importWarning')}</p><p>{t('importSafetyBackup')}</p></>}
        confirmLabel={t('continue')}
        cancelLabel={t('cancel')}
        onConfirm={confirmImport}
        onCancel={() => setStagedImport(null)}
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
