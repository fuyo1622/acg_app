import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Download,
  Globe,
  HardDrive,
  Heart,
  Package,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { db } from '../services/db';
import { useLanguage } from '../contexts/LanguageContext';
import AppDialog from './AppDialog';
import { BACKUP_VERSION } from '../utils/constants';
import {
  createBackupArchive,
  hasWishlistSection,
  readBackupFile,
  rehydrateBackup,
  replaceBackupInDb,
  validateBackupPayload,
} from '../utils/backupUtils';
import {
  formatBytes,
  getStorageStatus,
  isStorageNearCapacity,
  requestPersistentStorage,
} from '../utils/storageUtils';

// The URL stays valid for a minute: Safari reads a download after the click returns, and a
// URL revoked at once can leave it with nothing to save.
function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function isAppleMobile() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// An iPhone or iPad does not reliably keep a file downloaded from a home-screen app, so
// there a backup goes through the share sheet, where Save to Files keeps it.
function canShareFile(file) {
  if (!isAppleMobile() || typeof navigator.share !== 'function') return false;
  try {
    return typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

// Call it straight from a tap: the share sheet opens only for one. Where sharing this kind
// of file is refused, the file downloads instead.
async function shareFile(file) {
  try {
    await navigator.share({ files: [file] });
    return 'shared';
  } catch (error) {
    if (error?.name === 'AbortError') return 'cancelled';
    downloadFile(file);
    return 'downloaded';
  }
}

async function readBackupSections() {
  const [items, wishlist] = await Promise.all([db.items.toArray(), db.wishlist.toArray()]);
  return { items, wishlist };
}

async function createBackupFile(sections, prefix) {
  const archive = await createBackupArchive(sections);
  const filename = `${prefix}-${new Date().toISOString().slice(0, 10)}.zip`;
  return new File([archive], filename, { type: 'application/zip' });
}

const tabClassName = ({ isActive }) => `list-tab${isActive ? ' is-active' : ''}`;

const STORAGE_PANEL_HIDDEN_KEY = 'storagePanelHidden';

function readStoragePanelHidden() {
  try {
    return localStorage.getItem(STORAGE_PANEL_HIDDEN_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveStoragePanelHidden(hidden) {
  try {
    if (hidden) localStorage.setItem(STORAGE_PANEL_HIDDEN_KEY, 'true');
    else localStorage.removeItem(STORAGE_PANEL_HIDDEN_KEY);
  } catch {
    // Remembering the choice is a convenience; the panel still hides for this visit.
  }
}

// Shared by the collection and the wishlist. One backup file holds both lists, so export,
// import, and storage controls stay reachable from either tab.
export default function AppHeader({ title, storageRefreshKey, children }) {
  const { lang, setLang, t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [stagedImport, setStagedImport] = useState(null);
  const [readyExport, setReadyExport] = useState(null);
  const [unsavedSafetyImport, setUnsavedSafetyImport] = useState(null);
  const [storageStatus, setStorageStatus] = useState(null);
  const [storageHidden, setStorageHidden] = useState(readStoragePanelHidden);
  const fileInputRef = useRef(null);
  const showStorageRef = useRef(null);

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
  }, [storageRefreshKey]);

  const storageLocale = lang === 'zh-TW' ? 'zh-TW' : 'en';

  const showError = (messageKey) => {
    setNotice({ title: t('errorTitle'), message: t(messageKey) });
  };

  const handleExport = async () => {
    setIsProcessing(true);
    try {
      const file = await createBackupFile(await readBackupSections(), 'acg-backup');
      // A large backup takes a while to prepare, and the share sheet needs a tap of its
      // own, so it opens from the ready dialog.
      if (canShareFile(file)) setReadyExport(file);
      else downloadFile(file);
    } catch (error) {
      console.error(error);
      showError('exportError');
    } finally {
      setIsProcessing(false);
    }
  };

  // The share sheet decides where the file goes, so the app names it and says where to look.
  const saveReadyExport = async () => {
    const file = readyExport;
    setReadyExport(null);
    if (!file) return;

    const result = await shareFile(file);
    if (result === 'cancelled') return;
    setNotice({
      title: t('backupSavedTitle'),
      message: t(result === 'shared' ? 'backupSharedMessage' : 'backupDownloadedMessage', { name: file.name }),
    });
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const { payload, archive } = await readBackupFile(file);
      validateBackupPayload(payload, BACKUP_VERSION, archive);

      const current = await readBackupSections();
      const safetyBackup = current.items.length > 0 || current.wishlist.length > 0
        ? await createBackupFile(current, 'acg-auto-backup-before-import')
        : null;
      setStagedImport({ payload, archive, safetyBackup });
    } catch (error) {
      console.error(error);
      showError('importError');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsProcessing(false);
    }
  };

  const runImport = async ({ payload, archive }) => {
    setIsProcessing(true);
    try {
      await replaceBackupInDb(db, await rehydrateBackup(payload, archive));
      setNotice({ title: t('successTitle'), message: t('importSuccess') });
      setStorageStatus(await getStorageStatus());
    } catch (error) {
      console.error(error);
      showError('importError');
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmImport = async () => {
    const importData = stagedImport;
    setStagedImport(null);
    if (!importData) return;

    const { safetyBackup } = importData;
    if (safetyBackup && canShareFile(safetyBackup)) {
      // The current data is replaced only once its safety backup is kept, or once the
      // user says to go on without it.
      if (await shareFile(safetyBackup) === 'cancelled') {
        setUnsavedSafetyImport(importData);
        return;
      }
    } else if (safetyBackup) {
      downloadFile(safetyBackup);
    }
    await runImport(importData);
  };

  const replaceWithoutSafetyBackup = () => {
    const importData = unsavedSafetyImport;
    setUnsavedSafetyImport(null);
    if (importData) runImport(importData);
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

  // The panel takes room on small screens, so it can be hidden. A nearly-full warning
  // shows regardless, because it asks the user to act before data is lost.
  const storageNearFull = isStorageNearCapacity(storageStatus);
  const storageVisible = Boolean(storageStatus?.supported) && (!storageHidden || storageNearFull);

  const hideStorage = () => {
    setStorageHidden(true);
    saveStoragePanelHidden(true);
    // The hide button disappears with the panel; keep keyboard focus on its counterpart.
    setTimeout(() => showStorageRef.current?.focus(), 0);
  };

  const showStorage = () => {
    setStorageHidden(false);
    saveStoragePanelHidden(false);
  };

  const importWarningKey = stagedImport && !hasWishlistSection(stagedImport.payload)
    ? 'importWarningKeepsWishlist'
    : 'importWarning';

  return (
    <>
      <header className="home-header">
        <div className="flex-between home-title-row">
          <h1>{title}</h1>

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
              accept="application/zip,.zip,application/json,.json"
              aria-label={t('importFile')}
              className="sr-only"
              ref={fileInputRef}
              onChange={handleImport}
            />
            {storageStatus?.supported && !storageVisible && (
              <button
                type="button"
                ref={showStorageRef}
                onClick={showStorage}
                className="btn-icon glass-panel"
                title={t('showStorage')}
                aria-label={t('showStorage')}
              >
                <HardDrive size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <nav className="list-tabs glass-panel" aria-label={t('listsLabel')}>
          <NavLink to="/" end className={tabClassName}>
            <Package size={18} aria-hidden="true" />
            {t('collectionTab')}
          </NavLink>
          <NavLink to="/wishlist" className={tabClassName}>
            <Heart size={18} aria-hidden="true" />
            {t('wishlistTab')}
          </NavLink>
        </nav>

        {/* A large backup takes a while to prepare or restore; this says the app is on it. */}
        <p className="backup-status" role="status">{isProcessing ? t('backupWorking') : ''}</p>

        {storageVisible && (
          <section
            className={`storage-status glass-panel ${storageNearFull ? 'storage-warning' : ''}`}
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
              {storageNearFull && (
                <p className="storage-warning-text" role="alert">{t('storageWarning')}</p>
              )}
            </div>
            {!storageStatus.persistent && (
              <button type="button" className="btn btn-secondary storage-protect-btn" onClick={handlePersistentStorage}>
                <ShieldCheck size={18} aria-hidden="true" />
                {t('protectStorage')}
              </button>
            )}
            {!storageNearFull && (
              <button
                type="button"
                className="storage-hide-btn"
                onClick={hideStorage}
                title={t('hideStorage')}
                aria-label={t('hideStorage')}
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </section>
        )}

        {children}
      </header>

      <AppDialog
        open={Boolean(stagedImport)}
        title={t('importBackup')}
        message={<><p>{t(importWarningKey)}</p><p>{t('importSafetyBackup')}</p></>}
        confirmLabel={t('continue')}
        cancelLabel={t('cancel')}
        onConfirm={confirmImport}
        onCancel={() => setStagedImport(null)}
        destructive
      />
      <AppDialog
        open={Boolean(unsavedSafetyImport)}
        title={t('safetyBackupUnsavedTitle')}
        message={t('safetyBackupUnsavedMessage')}
        confirmLabel={t('replaceAnyway')}
        cancelLabel={t('cancel')}
        onConfirm={replaceWithoutSafetyBackup}
        onCancel={() => setUnsavedSafetyImport(null)}
        destructive
      />
      <AppDialog
        open={Boolean(readyExport)}
        title={t('exportReadyTitle')}
        message={t('exportReadyMessage', {
          name: readyExport?.name ?? '',
          size: readyExport ? formatBytes(readyExport.size, storageLocale) : '',
        })}
        confirmLabel={t('saveBackup')}
        cancelLabel={t('cancel')}
        onConfirm={saveReadyExport}
        onCancel={() => setReadyExport(null)}
      />
      <AppDialog
        open={Boolean(notice)}
        title={notice?.title}
        message={notice?.message}
        confirmLabel={t('close')}
        onConfirm={() => setNotice(null)}
      />
    </>
  );
}
