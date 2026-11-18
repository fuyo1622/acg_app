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
  isDetachedPhoto,
  readBackupFiles,
  recoverDetachedPhoto,
  rehydrateBackupFiles,
  repairDetachedPhotos,
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
// All files of one backup carry the day it was started, also when it is continued later.
function backupFileName({ prefix, date }, part) {
  const number = part.number === 1 && part.last ? '' : `-part${String(part.number).padStart(2, '0')}`;
  return `${prefix}-${date}${number}.zip`;
}

const isSingleFile = part => part.number === 1 && part.last;

// A backup in several files remembers how far it got, so that it can be continued after the
// app was closed, or after space was freed on the phone, instead of starting over:
// { version, id, date, saved, position, photos, bytes, fingerprint }, `saved` files so far.
const BACKUP_PROGRESS_KEY = 'acgBackupProgress';

function readBackupProgress() {
  try {
    const progress = JSON.parse(localStorage.getItem(BACKUP_PROGRESS_KEY));
    return progress?.version === 1 && typeof progress.id === 'string' && progress.saved > 0 ? progress : null;
  } catch {
    return null;
  }
}

function saveBackupProgress(progress) {
  try {
    localStorage.setItem(BACKUP_PROGRESS_KEY, JSON.stringify({ version: 1, ...progress }));
  } catch {
    // Without storage the backup cannot be continued later, but it still works now.
  }
}

function clearBackupProgress() {
  try {
    localStorage.removeItem(BACKUP_PROGRESS_KEY);
  } catch {
    // Nothing to clear.
  }
}

// A stopped backup can only be continued while the records are the ones it started with:
// its files are cut by position, and the last one counts the records.
function backupFingerprint({ items, wishlist }) {
  let hash = 0x811c9dc5;
  for (const record of [...items, ...wishlist]) {
    const updated = record.updated_at ? new Date(record.updated_at).getTime() : 0;
    for (const character of `${record.id}:${updated};`) {
      hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193);
    }
  }
  return `${items.length}:${wishlist.length}:${(hash >>> 0).toString(16)}`;
}

// The space the backup takes, from the photos saved and about to be: the whole of it, or
// what is left of it. Null without a photo to go by.
function estimateBackupBytes(job, part) {
  const photos = job.photosSaved + part.photos;
  if (photos === 0 || job.photos === 0) return null;
  const total = ((job.bytesSaved + part.file.size) / photos) * job.photos;
  return { total, remaining: Math.max(total - job.bytesSaved, part.file.size) };
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
  // The progress of a backup that stopped part way, offered to be continued.
  const [resumeOffer, setResumeOffer] = useState(null);
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
  // so only one file's photos are held at once. `resume` is the progress of a backup that
  // stopped, to continue it from its next file.
  const startBackupJob = (sections, { prefix, purpose, importData = null, resume = null }) => {
    endBackupJob();
    const partBytes = backupPartBytes();
    const job = {
      prefix,
      purpose,
      importData,
      partBytes,
      date: resume?.date ?? new Date().toISOString().slice(0, 10),
      saved: resume?.saved ?? 0,
      names: [],
      photos: countPhotos(sections),
      photosSaved: resume?.photos ?? 0,
      bytesSaved: resume?.bytes ?? 0,
      fingerprint: purpose === 'backup' ? backupFingerprint(sections) : null,
      skippedPhotos: 0,
    };
    let photosDone = job.photosSaved;
    job.parts = createBackupParts(sections, {
      partBytes,
      // A photo still stored as a copy of a whole backup archive is taken out of it; one that
      // cannot be is left out, rather than fill the file with the archive.
      preparePhoto: async (photo) => {
        if (!isDetachedPhoto(photo)) return shrinkPhotoForBackup(photo);
        const recovered = await recoverDetachedPhoto(photo);
        if (recovered) return shrinkPhotoForBackup(recovered);
        job.skippedPhotos += 1;
        return null;
      },
      onPhotoDone: () => {
        photosDone += 1;
        if (backupJobRef.current === job) setProgress(current => ({ ...current, done: photosDone }));
      },
      resume: resume && { id: resume.id, number: resume.saved + 1, position: resume.position },
    });
    backupJobRef.current = job;
    return job;
  };

  // The job's next file, or null when the job was stopped in the meantime. With
  // `{ partBytes }`, the file just offered is made again as files of that size instead.
  const prepareNextPart = async (job, request) => {
    setProgress(current => ({ part: job.saved + 1, done: current?.done ?? job.photosSaved, total: job.photos }));
    keepScreenOn();
    setIsProcessing(true);
    try {
      const { value, done } = await job.parts.next(request);
      if (done || backupJobRef.current !== job) return null;
      const file = new File([value.blob], backupFileName(job, value), { type: 'application/zip' });
      return {
        number: value.number,
        last: value.last,
        purpose: job.purpose,
        file,
        backup: value.backup,
        photos: value.photos,
        position: value.position,
      };
    } finally {
      setIsProcessing(false);
    }
  };

  // After a file of the job is saved: remember how far a backup got, then prepare the next
  // file, or finish the job.
  const continueBackupJob = async (job, part, result) => {
    job.saved += 1;
    job.names.push(part.file.name);
    job.photosSaved += part.photos;
    job.bytesSaved += part.file.size;
    if (job.purpose === 'backup') {
      if (part.last) {
        clearBackupProgress();
      } else {
        saveBackupProgress({
          id: part.backup,
          date: job.date,
          saved: job.saved,
          position: part.position,
          photos: job.photosSaved,
          bytes: job.bytesSaved,
          fingerprint: job.fingerprint,
        });
      }
    }
    if (!part.last) {
      const next = await prepareNextPart(job);
      if (next) setReadyPart(next);
      return;
    }

    endBackupJob();
    // Photos that could not be read were left out; the last message says how many.
    const withSkipped = message => (job.skippedPhotos > 0
      ? [message, t('backupSkippedPhotos', { count: job.skippedPhotos })].join(lang === 'en' ? ' ' : '')
      : message);
    if (job.purpose === 'safety') {
      await runImport(job.importData);
    } else if (job.saved === 1) {
      // The share sheet decides where the file goes, so the app names it and says where to look.
      setNotice({
        title: t('backupSavedTitle'),
        message: withSkipped(t(result === 'shared' ? 'backupSharedMessage' : 'backupDownloadedMessage', { name: part.file.name })),
      });
    } else {
      setNotice({
        title: t('backupPartsSavedTitle', { count: job.saved }),
        message: withSkipped(t('backupPartsSavedMessage', {
          count: job.saved,
          first: backupFileName(job, { number: 1, last: false }),
          last: part.file.name,
        })),
      });
    }
  };

  // Photos restored from a backup can be stored as copies of the whole backup file (see
  // repairDetachedPhotos); they are repaired before anything is backed up.
  const repairStoredPhotos = async () => {
    setProgress({ checking: true, done: 0, total: 0 });
    try {
      return await repairDetachedPhotos(db, {
        onProgress: ({ done, total }) => setProgress({ checking: true, done, total }),
      });
    } finally {
      setProgress(null);
    }
  };

  // Saves a new backup, or continues the stopped one whose progress is `resume`.
  const exportBackup = async (stoppedBackup = null) => {
    setIsProcessing(true);
    try {
      const repair = await repairStoredPhotos();
      // Files saved before photos were repaired may hold damaged copies: start over.
      const resume = repair.repaired > 0 ? null : stoppedBackup;
      const sections = await readBackupSections();
      const records = sections.items.length + sections.wishlist.length;
      if (resume && (backupFingerprint(sections) !== resume.fingerprint || resume.position >= records)) {
        clearBackupProgress();
        setNotice({ title: t('backupResumeChangedTitle'), message: t('backupResumeChangedMessage') });
        return;
      }
      if (!resume) clearBackupProgress();
      const job = startBackupJob(sections, { prefix: 'acg-backup', purpose: 'backup', resume });
      const part = await prepareNextPart(job);
      if (!part) return;
      // A backup in one file downloads at once where there is no share sheet. Otherwise each
      // file opens from a dialog: preparing it takes a while, and the share sheet needs a tap.
      if (isSingleFile(part) && !canShareFile(part.file)) {
        downloadFile(part.file);
        endBackupJob();
        return;
      }
      // Before the first file, say how much space the files will need, and what was repaired.
      const estimate = isSingleFile(part) ? null : estimateBackupBytes(job, part);
      setReadyPart({
        ...part,
        estimate: estimate && { bytes: resume ? estimate.remaining : estimate.total, rest: Boolean(resume) },
        repair: { ...repair, startedOver: Boolean(stoppedBackup) && !resume },
      });
    } catch (error) {
      console.error(error);
      endBackupJob();
      showError('exportError');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    const progress = readBackupProgress();
    if (progress) setResumeOffer(progress);
    else exportBackup();
  };

  const continueStoppedBackup = () => {
    const progress = resumeOffer;
    setResumeOffer(null);
    exportBackup(progress);
  };

  const startBackupOver = () => {
    setResumeOffer(null);
    clearBackupProgress();
    exportBackup();
  };

  // The share sheet could not take the file: its records are made again as files of half
  // the size, and the files after them keep that size. Below the smallest size the cause is
  // not the size, so the backup stops, says what to do, and can be continued later.
  const offerSmallerPart = async (job, part, error) => {
    const partBytes = Math.floor(job.partBytes / 2);
    if (partBytes < minimumPartBytes()) {
      endBackupJob();
      const estimate = estimateBackupBytes(job, part);
      const values = {
        reason: `${error?.name ?? 'Error'}: ${error?.message ?? ''}`,
        size: formatBytes(estimate?.remaining ?? part.file.size, storageLocale),
        count: job.saved,
        next: job.saved + 1,
      };
      const canContinue = job.purpose === 'backup' && job.saved > 0;
      setNotice({
        title: t('backupShareFailedTitle'),
        message: t(canContinue ? 'backupShareFailedResumeMessage' : 'backupShareFailedMessage', values),
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
      // Its progress is kept, so the next Export Backup can continue it.
      setNotice({ title: t('backupStoppedTitle'), message: t('backupStoppedMessage', { count: job.saved, next: job.saved + 1 }) });
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
      // The safety backup of the current data must not be filled with damaged photos.
      await repairStoredPhotos();
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
    if (progress?.checking) {
      if (!progress.total) return t('backupCheckingPhotosStart');
      return t('backupCheckingPhotos', {
        done: formatCount(progress.done),
        total: formatCount(progress.total),
      });
    }
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
      estimate: readyPart.estimate ? formatBytes(readyPart.estimate.bytes, storageLocale) : '',
      repaired: formatCount(readyPart.repair?.repaired ?? 0),
      unreadable: formatCount(readyPart.repair?.failed ?? 0),
    };
    // Chinese sentences follow each other without a space.
    const sentences = (...keys) => keys.map(key => t(key, values)).join(lang === 'en' ? ' ' : '');
    const smaller = readyPart.madeSmaller ? ['backupMadeSmaller'] : [];
    const repair = [
      ...(readyPart.repair?.repaired > 0 ? ['backupRepairedPhotos'] : []),
      ...(readyPart.repair?.startedOver ? ['backupRepairedStartOver'] : []),
      ...(readyPart.repair?.failed > 0 ? ['backupUnreadablePhotos'] : []),
    ];
    if (isSingleFile(readyPart)) {
      return { title: t('exportReadyTitle'), message: sentences(...repair, ...smaller, 'exportReadyMessage') };
    }
    const estimate = readyPart.estimate ? [readyPart.estimate.rest ? 'backupEstimateRest' : 'backupEstimateTotal'] : [];
    return {
      title: t(readyPart.purpose === 'safety' ? 'safetyPartReadyTitle' : 'exportPartReadyTitle', values),
      message: sentences(
        ...repair,
        ...smaller,
        'exportPartReadyMessage',
        ...estimate,
        readyPart.last ? 'exportPartReadyLast' : 'exportPartReadyNext',
      ),
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
        open={Boolean(resumeOffer)}
        title={t('backupResumeTitle')}
        message={resumeOffer ? t('backupResumeMessage', {
          count: resumeOffer.saved,
          first: backupFileName({ prefix: 'acg-backup', date: resumeOffer.date }, { number: 1, last: false }),
          last: backupFileName({ prefix: 'acg-backup', date: resumeOffer.date }, { number: resumeOffer.saved, last: false }),
          next: resumeOffer.saved + 1,
        }) : ''}
        confirmLabel={t('continue')}
        secondaryLabel={t('backupStartOver')}
        cancelLabel={t('cancel')}
        onConfirm={continueStoppedBackup}
        onSecondary={startBackupOver}
        onCancel={() => setResumeOffer(null)}
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
