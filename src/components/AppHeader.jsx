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
import {
  BACKUP_MIN_PART_BYTES,
  BACKUP_PART_BYTES,
  BACKUP_SHARE_PART_BYTES,
  BACKUP_VERSION,
} from '../utils/constants';
import {
  BackupPartsError,
  createBackupParts,
  hasWishlistSection,
  readBackupFiles,
  rehydrateBackupFiles,
  replaceBackupInDb,
  validateBackupFiles,
} from '../utils/backupUtils';
import { shrinkPhotoForBackup } from '../utils/imageUtils';
import { getPhotos } from '../utils/photoUtils';
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
function usesShareSheet() {
  return isAppleMobile() && typeof navigator.share === 'function';
}

function canShareFile(file) {
  if (!usesShareSheet()) return false;
  try {
    return typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

// Safari reads the whole file into memory before the share sheet opens. When it cannot, or
// the sheet cannot open, it reports an AbortError, as when a person closes the sheet, but
// at once and without showing it. Nobody opens the sheet and closes it again this fast.
const SHARE_FAILED_WITHIN_MS = 1500;

// Call it straight from a tap: the share sheet opens only for one. The result is `shared`,
// `cancelled` (closed without saving), `failed` (with the `error`), or `downloaded` where
// sharing this kind of file is refused and it downloads instead.
async function shareFile(file) {
  const startedAt = Date.now();
  try {
    await navigator.share({ files: [file] });
    return { outcome: 'shared' };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const failed = /read/i.test(error.message ?? '') || Date.now() - startedAt < SHARE_FAILED_WITHIN_MS;
      return failed ? { outcome: 'failed', error } : { outcome: 'cancelled' };
    }
    downloadFile(file);
    return { outcome: 'downloaded' };
  }
}

async function saveBackupFile(file) {
  if (canShareFile(file)) return shareFile(file);
  downloadFile(file);
  return { outcome: 'downloaded' };
}

async function readBackupSections() {
  const [items, wishlist, terms] = await Promise.all([db.items.toArray(), db.wishlist.toArray(), db.terms.toArray()]);
  return { items, wishlist, terms };
}

// Tests set these to get several parts, and smaller ones, out of a few small photos.
const TEST_PART_BYTES_KEY = 'acgBackupPartBytes';
const TEST_MIN_PART_BYTES_KEY = 'acgBackupMinPartBytes';

function sizeSetting(testKey, fallback) {
  try {
    const override = Number(sessionStorage.getItem(testKey));
    return override > 0 ? override : fallback;
  } catch {
    return fallback;
  }
}

const backupPartBytes = () => sizeSetting(
  TEST_PART_BYTES_KEY,
  usesShareSheet() ? BACKUP_SHARE_PART_BYTES : BACKUP_PART_BYTES,
);
const minimumPartBytes = () => sizeSetting(TEST_MIN_PART_BYTES_KEY, BACKUP_MIN_PART_BYTES);

function countPhotos({ items, wishlist }) {
  return [...items, ...wishlist].reduce((total, record) => total + getPhotos(record).length, 0);
}

// A backup in one file keeps the name it always had; the files of a larger one are numbered.
function backupFileName(prefix, part) {
  const date = new Date().toISOString().slice(0, 10);
  const number = part.number === 1 && part.last ? '' : `-part${String(part.number).padStart(2, '0')}`;
  return `${prefix}-${date}${number}.zip`;
}

const isSingleFile = part => part.number === 1 && part.last;

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

// Shared by the collection and the wishlist. One backup holds both lists, so export,
// import, and storage controls stay reachable from either tab.
export default function AppHeader({ title, storageRefreshKey, children }) {
  const { lang, setLang, t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState(null);
  const [stagedImport, setStagedImport] = useState(null);
  const [readyPart, setReadyPart] = useState(null);
  const [progress, setProgress] = useState(null);
  const [unsavedSafetyImport, setUnsavedSafetyImport] = useState(null);
  const [storageStatus, setStorageStatus] = useState(null);
  const [storageHidden, setStorageHidden] = useState(readStoragePanelHidden);
  const fileInputRef = useRef(null);
  const showStorageRef = useRef(null);
  // The backup being saved, one file at a time: { prefix, purpose, importData, parts, saved, names }.
  const backupJobRef = useRef(null);
  const wakeLockRef = useRef(null);

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

  const showImportError = (error) => {
    const separator = lang === 'en' ? ', ' : '、';
    const messages = error instanceof BackupPartsError ? {
      missingParts: error.total === null
        ? t('importMissingLastPart')
        : t('importMissingParts', { total: error.total, missing: error.missing.join(separator) }),
      mixedBackups: t('importMixedBackups'),
      severalBackups: t('importSeveralBackups'),
      repeatedParts: t('importRepeatedPart', { number: error.number }),
    } : {};
    setNotice({ title: t('errorTitle'), message: messages[error?.code] ?? t('importError') });
  };

  // A large backup takes minutes, and a phone that locks its screen pauses the app.
  const keepScreenOn = async () => {
    if (wakeLockRef.current && !wakeLockRef.current.released) return;
    try {
      wakeLockRef.current = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      wakeLockRef.current = null;
    }
  };

  const endBackupJob = () => {
    const job = backupJobRef.current;
    backupJobRef.current = null;
    job?.parts.return().catch(() => {});
    setProgress(null);
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  };

  useEffect(() => () => endBackupJob(), []);

  // Starts saving `sections` as a backup. Its files are made one at a time, when asked for,
  // so only one file's photos are held at once.
  const startBackupJob = (sections, { prefix, purpose, importData = null }) => {
    endBackupJob();
    const partBytes = backupPartBytes();
    const job = { prefix, purpose, importData, partBytes, saved: 0, names: [], photos: countPhotos(sections) };
    let photosDone = 0;
    job.parts = createBackupParts(sections, {
      partBytes,
      preparePhoto: shrinkPhotoForBackup,
      onPhotoDone: () => {
        photosDone += 1;
        if (backupJobRef.current === job) setProgress(current => ({ ...current, done: photosDone }));
      },
    });
    backupJobRef.current = job;
    return job;
  };

  // The job's next file, or null when the job was stopped in the meantime. With
  // `{ partBytes }`, the file just offered is made again as files of that size instead.
  const prepareNextPart = async (job, request) => {
    setProgress(current => ({ part: job.saved + 1, done: current?.done ?? 0, total: job.photos }));
    keepScreenOn();
    setIsProcessing(true);
    try {
      const { value, done } = await job.parts.next(request);
      if (done || backupJobRef.current !== job) return null;
      const file = new File([value.blob], backupFileName(job.prefix, value), { type: 'application/zip' });
      return { number: value.number, last: value.last, purpose: job.purpose, file };
    } finally {
      setIsProcessing(false);
    }
  };

  // After a file of the job is saved: prepare the next one, or finish the job.
  const continueBackupJob = async (job, part, result) => {
    job.saved += 1;
    job.names.push(part.file.name);
    if (!part.last) {
      const next = await prepareNextPart(job);
      if (next) setReadyPart(next);
      return;
    }

    endBackupJob();
    if (job.purpose === 'safety') {
      await runImport(job.importData);
    } else if (job.saved === 1) {
      // The share sheet decides where the file goes, so the app names it and says where to look.
      setNotice({
        title: t('backupSavedTitle'),
        message: t(result === 'shared' ? 'backupSharedMessage' : 'backupDownloadedMessage', { name: part.file.name }),
      });
    } else {
      setNotice({
        title: t('backupPartsSavedTitle', { count: job.saved }),
        message: t('backupPartsSavedMessage', { count: job.saved, first: job.names[0], last: job.names.at(-1) }),
      });
    }
  };

  const handleExport = async () => {
    setIsProcessing(true);
    try {
      const job = startBackupJob(await readBackupSections(), { prefix: 'acg-backup', purpose: 'backup' });
      const part = await prepareNextPart(job);
      if (!part) return;
      // A backup in one file downloads at once where there is no share sheet. Otherwise each
      // file opens from a dialog: preparing it takes a while, and the share sheet needs a tap.
      if (isSingleFile(part) && !canShareFile(part.file)) {
        downloadFile(part.file);
        endBackupJob();
        return;
      }
      setReadyPart(part);
    } catch (error) {
      console.error(error);
      endBackupJob();
      showError('exportError');
    } finally {
      setIsProcessing(false);
    }
  };

  // The share sheet could not take the file: its records are made again as files of half
  // the size, and the files after them keep that size. Below the smallest size the backup
  // stops and says why, rather than offer a file that cannot be saved.
  const offerSmallerPart = async (job, part, error) => {
    const partBytes = Math.floor(job.partBytes / 2);
    if (partBytes < minimumPartBytes()) {
      endBackupJob();
      setNotice({
        title: t('backupShareFailedTitle'),
        message: t('backupShareFailedMessage', { reason: `${error?.name ?? 'Error'}: ${error?.message ?? ''}` }),
      });
      return;
    }
    job.partBytes = partBytes;
    const next = await prepareNextPart(job, { partBytes });
    if (next) setReadyPart({ ...next, madeSmaller: next.file.size < part.file.size });
  };

  // After the share sheet or a download took a file of the job (or could not).
  const afterSaving = async (job, part, { outcome, error }) => {
    try {
      if (outcome === 'failed') await offerSmallerPart(job, part, error);
      else await continueBackupJob(job, part, outcome);
    } catch (caught) {
      console.error(caught);
      endBackupJob();
      showError(job.purpose === 'safety' ? 'importError' : 'exportError');
    }
  };

  const saveReadyPart = async () => {
    const part = readyPart;
    const job = backupJobRef.current;
    setReadyPart(null);
    if (!part || !job) return;

    const result = await saveBackupFile(part.file);
    if (result.outcome === 'cancelled') {
      // A backup in several files is no use without all of them, so the same file is
      // offered again; stopping is a choice of its own.
      if (isSingleFile(part)) endBackupJob();
      else setReadyPart({ ...part, madeSmaller: false });
      return;
    }
    await afterSaving(job, part, result);
  };

  const stopBackupJob = () => {
    const job = backupJobRef.current;
    setReadyPart(null);
    endBackupJob();
    if (job?.purpose === 'safety') {
      setUnsavedSafetyImport(job.importData);
    } else if (job?.saved > 0) {
      setNotice({ title: t('backupStoppedTitle'), message: t('backupStoppedMessage') });
    }
  };

  const handleImport = async (event) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setIsProcessing(true);
    try {
      const opened = await readBackupFiles(files);
      validateBackupFiles(opened, BACKUP_VERSION);

      const importData = { opened };
      const current = await readBackupSections();
      let safetyPart = null;
      if (current.items.length > 0 || current.wishlist.length > 0) {
        // The first file of the safety backup is ready before the question, so that the
        // tap answering it can open the share sheet.
        const job = startBackupJob(current, { prefix: 'acg-auto-backup-before-import', purpose: 'safety', importData });
        safetyPart = await prepareNextPart(job);
        if (!safetyPart) return;
      }
      setStagedImport({ ...importData, safetyPart });
    } catch (error) {
      console.error(error);
      endBackupJob();
      showImportError(error);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsProcessing(false);
    }
  };

  async function runImport({ opened }) {
    setIsProcessing(true);
    try {
      await replaceBackupInDb(db, await rehydrateBackupFiles(opened));
      setNotice({ title: t('successTitle'), message: t('importSuccess') });
      setStorageStatus(await getStorageStatus());
    } catch (error) {
      console.error(error);
      showError('importError');
    } finally {
      setIsProcessing(false);
    }
  }

  const confirmImport = async () => {
    const importData = stagedImport;
    setStagedImport(null);
    if (!importData) return;

    const job = backupJobRef.current;
    const { safetyPart } = importData;
    if (!safetyPart || !job) {
      await runImport(importData);
      return;
    }

    // The current data is replaced only once its safety backup is kept, or once the user
    // says to go on without it.
    const result = await saveBackupFile(safetyPart.file);
    if (result.outcome === 'cancelled') {
      endBackupJob();
      setUnsavedSafetyImport(importData);
      return;
    }
    await afterSaving(job, safetyPart, result);
  };

  const cancelImport = () => {
    setStagedImport(null);
    endBackupJob();
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

  const importWarningKey = stagedImport && !hasWishlistSection(stagedImport.opened[0].payload)
    ? 'importWarningKeepsWishlist'
    : 'importWarning';

  const formatCount = count => count.toLocaleString(storageLocale);
  const statusText = (() => {
    if (!isProcessing) return '';
    if (progress?.total > 0) {
      return t('backupPreparing', {
        part: progress.part,
        done: formatCount(Math.min(progress.done, progress.total)),
        total: formatCount(progress.total),
      });
    }
    return t('backupWorking');
  })();

  const readyDialog = (() => {
    if (!readyPart) return { title: '', message: '' };
    const values = {
      number: readyPart.number,
      name: readyPart.file.name,
      size: formatBytes(readyPart.file.size, storageLocale),
    };
    // Chinese sentences follow each other without a space.
    const sentences = (...keys) => keys.map(key => t(key, values)).join(lang === 'en' ? ' ' : '');
    const smaller = readyPart.madeSmaller ? ['backupMadeSmaller'] : [];
    if (isSingleFile(readyPart)) {
      return { title: t('exportReadyTitle'), message: sentences(...smaller, 'exportReadyMessage') };
    }
    return {
      title: t(readyPart.purpose === 'safety' ? 'safetyPartReadyTitle' : 'exportPartReadyTitle', values),
      message: sentences(...smaller, 'exportPartReadyMessage', readyPart.last ? 'exportPartReadyLast' : 'exportPartReadyNext'),
    };
  })();

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
              disabled={isProcessing || Boolean(readyPart)}
              className="btn-icon glass-panel"
              title={t('exportBackup')}
              aria-label={t('exportBackup')}
            >
              <Download size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || Boolean(readyPart)}
              className="btn-icon glass-panel"
              title={t('importBackup')}
              aria-label={t('importBackup')}
            >
              <Upload size={18} aria-hidden="true" />
            </button>
            <input
              type="file"
              accept="application/zip,.zip,application/json,.json"
              multiple
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
        <p className="backup-status" role="status">{statusText}</p>

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
        onCancel={cancelImport}
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
        open={Boolean(readyPart)}
        title={readyDialog.title}
        message={readyDialog.message}
        confirmLabel={t('saveBackup')}
        cancelLabel={t(readyPart && !isSingleFile(readyPart) ? 'stopBackup' : 'cancel')}
        onConfirm={saveReadyPart}
        onCancel={stopBackupJob}
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
