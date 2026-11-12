import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveQuery } from 'dexie-react-hooks';
import { LanguageProvider } from '../contexts/LanguageContext';
import { takeAlbumFiles } from '../utils/albumHandoff';
import { createBackupParts, replaceBackupInDb } from '../utils/backupUtils';
import { APP_RELEASE_URL, APP_VERSION } from '../utils/version';
import { readZip } from '../utils/zipUtils';
import Home from './Home';

const dbMocks = vi.hoisted(() => ({
  items: {
    toArray: vi.fn(),
    orderBy: vi.fn(() => ({
      reverse: vi.fn(() => ({
        toArray: vi.fn(),
      })),
    })),
  },
  wishlist: {
    toArray: vi.fn(),
  },
  terms: {
    toArray: vi.fn(),
  },
  transaction: vi.fn(),
}));

const backupMocks = vi.hoisted(() => ({
  replaceBackupInDb: vi.fn(),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}));

vi.mock('../services/db', () => ({
  db: dbMocks,
}));

vi.mock('../utils/backupUtils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    // The real one, watched, to see the size of the files a backup is made in.
    createBackupParts: vi.fn(actual.createBackupParts),
    replaceBackupInDb: backupMocks.replaceBackupInDb,
  };
});

function homeElement() {
  return (
    <LanguageProvider>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </LanguageProvider>
  );
}

function renderHome() {
  return render(homeElement());
}

function collectionItem(id, photoBytes) {
  let photo = null;

  if (photoBytes) {
    photo = new Blob(['photo'], { type: 'image/webp' });
    Object.defineProperty(photo, 'size', { value: photoBytes });
  }

  return {
    id,
    series: ['Current Series'],
    character: ['Current Character'],
    merchandise_type: 'figure',
    notes: '',
    photos: photo ? [photo] : [],
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function wishlistEntry(id, name) {
  return {
    id,
    name,
    series: [],
    character: [],
    merchandise_type: '',
    links: [],
    price: null,
    currency: 'TWD',
    shop: '',
    order_deadline: null,
    release: '',
    priority: 'medium',
    status: 'want',
    notes: '',
    photos: [],
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };
}

// jsdom has no StorageManager, so the storage panel only renders with this stand-in.
function stubStorageManager({ usage = 100, quota = 1000 } = {}) {
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: {
      estimate: vi.fn().mockResolvedValue({ usage, quota }),
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(false),
    },
  });
}

describe('Home smoke flows', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    vi.mocked(useLiveQuery).mockReturnValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    dbMocks.items.toArray.mockResolvedValue([]);
    dbMocks.wishlist.toArray.mockResolvedValue([]);
    dbMocks.terms.toArray.mockResolvedValue([]);
    backupMocks.replaceBackupInDb.mockResolvedValue(undefined);
    // A subclass keeps `new URL()` working for link validation while object URLs are faked.
    const TestUrl = class extends globalThis.URL {};
    TestUrl.createObjectURL = vi.fn(() => 'blob:backup');
    TestUrl.revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', TestUrl);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    delete navigator.storage;
    localStorage.removeItem('storagePanelHidden');
  });

  it('hides the storage panel, remembers the choice, and shows it again from the header', async () => {
    stubStorageManager();
    const { unmount } = renderHome();

    const panel = await screen.findByRole('region', { name: 'Browser storage' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Hide storage details' }));

    expect(screen.queryByRole('region', { name: 'Browser storage' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Show storage details' })).toHaveFocus();
    });

    unmount();
    renderHome();
    fireEvent.click(await screen.findByRole('button', { name: 'Show storage details' }));

    expect(screen.getByRole('region', { name: 'Browser storage' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show storage details' })).not.toBeInTheDocument();
  });

  it('keeps a nearly full storage warning visible even after the panel was hidden', async () => {
    localStorage.setItem('storagePanelHidden', 'true');
    stubStorageManager({ usage: 900, quota: 1000 });
    renderHome();

    const panel = await screen.findByRole('region', { name: 'Browser storage' });
    expect(within(panel).getByRole('alert')).toHaveTextContent('nearly full');
    expect(within(panel).queryByRole('button', { name: 'Hide storage details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show storage details' })).not.toBeInTheDocument();
  });

  it('renders safely with an empty collection', () => {
    renderHome();

    expect(screen.getByRole('heading', { name: 'My Collection' })).toBeInTheDocument();
    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters or add a new item.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Send feedback' })).toHaveAttribute(
      'href',
      'https://tally.so/r/KYNy7M',
    );
    expect(screen.getByRole('link', { name: 'User guide' })).toHaveAttribute(
      'href',
      '/guide',
    );
    expect(screen.getByRole('link', { name: `Version ${APP_VERSION}` })).toHaveAttribute(
      'href',
      APP_RELEASE_URL,
    );
  });

  it('renders existing items from mocked data', () => {
    vi.mocked(useLiveQuery).mockReturnValue([
      {
        id: 1,
        series: 'Neon Genesis Evangelion',
        character: 'Asuka Langley',
        merchandise_type: 'figure',
        photo: null,
      },
    ]);

    renderHome();

    const gallery = screen.getByRole('main');
    expect(within(gallery).getByRole('heading', { name: 'Asuka Langley' })).toBeInTheDocument();
    expect(within(gallery).getByText('Neon Genesis Evangelion')).toBeInTheDocument();
    expect(screen.queryByText('No items found')).not.toBeInTheDocument();
  });

  it('shows backup actions and wires import to the hidden file input', () => {
    renderHome();

    expect(screen.getByRole('button', { name: 'Export Backup' })).toBeEnabled();
    const importButton = screen.getByRole('button', { name: 'Import Backup' });
    const importInput = screen.getByLabelText('Import backup file');
    const clickSpy = vi.spyOn(importInput, 'click').mockImplementation(() => {});

    expect(importInput).toHaveAttribute('accept', 'application/zip,.zip,application/json,.json');
    // A backup saved in several files is restored from all of them, chosen at once.
    expect(importInput).toHaveAttribute('multiple');
    fireEvent.click(importButton);

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('updates the document language when the user switches languages', () => {
    renderHome();
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), {
      target: { value: 'zh-TW' },
    });
    expect(document.documentElement).toHaveAttribute('lang', 'zh-TW');
  });

  it('rejects malformed backup import without replacing database items', async () => {
    renderHome();

    const importInput = screen.getByLabelText('Import backup file');
    const malformedBackup = new File(['{bad json'], 'backup.json', {
      type: 'application/json',
    });
    Object.defineProperty(malformedBackup, 'text', {
      value: vi.fn().mockResolvedValue('{bad json'),
    });

    fireEvent.change(importInput, {
      target: { files: [malformedBackup] },
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Something went wrong' }))
        .toHaveTextContent('Invalid backup file or corrupted payload version.');
    });
    expect(replaceBackupInDb).not.toHaveBeenCalled();
  });

  it('downloads an automatic safety backup before replacing current items', async () => {
    const currentItems = [{
      id: 1,
      series: ['Current Series'],
      character: ['Current Character'],
      merchandise_type: 'figure',
      notes: '',
      photo: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    }];
    dbMocks.items.toArray.mockResolvedValue(currentItems);
    vi.mocked(useLiveQuery).mockReturnValue(currentItems);
    renderHome();

    const importFile = new File(['backup'], 'backup.json', { type: 'application/json' });
    Object.defineProperty(importFile, 'text', {
      value: vi.fn().mockResolvedValue(JSON.stringify({
        version: 2,
        items: [{
          id: 2,
          series: ['Imported Series'],
          character: [],
          merchandise_type: 'plush',
          notes: '',
          photo: null,
          created_at: '2026-02-01T00:00:00.000Z',
          updated_at: '2026-02-01T00:00:00.000Z',
        }],
      })),
    });

    fireEvent.change(screen.getByLabelText('Import backup file'), {
      target: { files: [importFile] },
    });
    const importDialog = await screen.findByRole('alertdialog', { name: 'Import Backup' });
    expect(importDialog).toHaveTextContent('safety backup');
    expect(importDialog).toHaveTextContent('keep your current wishlist');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
      expect(replaceBackupInDb).toHaveBeenCalledWith(dbMocks, {
        items: [
          expect.objectContaining({
            id: 2,
            series: ['Imported Series'],
            character: [],
            merchandise_type: 'plush',
          }),
        ],
        wishlist: undefined,
        terms: [],
      });
    });
  });

  it('replaces the wishlist too when a version 3 backup is imported', async () => {
    dbMocks.wishlist.toArray.mockResolvedValue([wishlistEntry(1, 'Current wish')]);
    renderHome();

    const importFile = new File(['backup'], 'backup.json', { type: 'application/json' });
    Object.defineProperty(importFile, 'text', {
      value: vi.fn().mockResolvedValue(JSON.stringify({
        version: 3,
        items: [],
        wishlist: [{
          id: 4,
          name: 'Imported wish',
          links: [{ url: 'https://www.amiami.com/item', label: '' }],
          status: 'ordered',
          created_at: '2026-02-01T00:00:00.000Z',
        }],
      })),
    });

    fireEvent.change(screen.getByLabelText('Import backup file'), {
      target: { files: [importFile] },
    });
    expect(await screen.findByRole('alertdialog', { name: 'Import Backup' }))
      .toHaveTextContent('REPLACE your current collection and wishlist');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      // The current wishlist alone is enough to trigger the safety backup.
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
      expect(replaceBackupInDb).toHaveBeenCalledWith(dbMocks, {
        items: [],
        wishlist: [expect.objectContaining({ id: 4, name: 'Imported wish', status: 'ordered' })],
        terms: [],
      });
    });
  });

  it('exports the wishlist in the same backup file as the collection', async () => {
    dbMocks.items.toArray.mockResolvedValue([collectionItem(1, 0)]);
    dbMocks.wishlist.toArray.mockResolvedValue([wishlistEntry(5, 'Rei plush')]);
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Export Backup' }));

    await waitFor(() => {
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });
    const [backupFile] = vi.mocked(URL.createObjectURL).mock.calls
      .map(([blob]) => blob)
      .filter(blob => blob.type === 'application/zip');
    const exported = JSON.parse(await (await readZip(backupFile)).text('backup.json'));
    expect(exported.version).toBe(6);
    expect(exported.part).toEqual(expect.objectContaining({ number: 1, last: true, parts: 1, items: 1, wishlist: 1 }));
    expect(exported.items).toEqual([expect.objectContaining({ id: 1, photos: [] })]);
    expect(exported.items[0]).not.toHaveProperty('photo');
    expect(exported.wishlist).toEqual([expect.objectContaining({ id: 5, name: 'Rei plush', photos: [] })]);
  });

  it('opens the album import with the photos chosen here', () => {
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/import" element={<p>Album import page</p>} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>,
    );
    const files = [new File(['photo'], 'figure.png', { type: 'image/png' })];

    fireEvent.change(screen.getByLabelText('Album photos'), { target: { files } });

    expect(screen.getByText('Album import page')).toBeInTheDocument();
    expect(takeAlbumFiles()).toEqual(files);
  });

  it('counts the items that need details and can show only those', () => {
    const unfinished = { ...collectionItem(2, 0), series: [], character: [], merchandise_type: '' };
    vi.mocked(useLiveQuery).mockReturnValue([collectionItem(1, 0), unfinished]);
    renderHome();
    const itemLinks = () => screen.getAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('/item/'));

    expect(screen.getByText('Needs details: 1')).toBeInTheDocument();
    expect(itemLinks()).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Show only these' }));
    expect(itemLinks().map(link => link.getAttribute('href'))).toEqual(['/item/2']);
    expect(within(itemLinks()[0]).getByText('Needs details')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(itemLinks()).toHaveLength(2);
  });

  it('opens an item with the order of the list as filtered, for moving between items', () => {
    const unfinished = id => ({ ...collectionItem(id, 0), series: [], character: [], merchandise_type: '' });
    vi.mocked(useLiveQuery).mockReturnValue([collectionItem(1, 0), unfinished(2), unfinished(3)]);
    function ItemPage() {
      const location = useLocation();
      return <p>Order: {location.state?.order.join(', ')}</p>;
    }
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/item/:id" element={<ItemPage />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show only these' }));
    fireEvent.click(screen.getAllByRole('link').find(link => link.getAttribute('href') === '/item/3'));

    expect(screen.getByText('Order: 2, 3')).toBeInTheDocument();
  });

  it('lists the filters in the saved order, leaving out series no item uses', () => {
    vi.mocked(useLiveQuery).mockImplementation((query) => {
      if (query.toString().includes('db.terms')) {
        return [
          { field: 'series', values: ['Macross', 'Gundam', 'Evangelion'] },
          { field: 'merchandise_type', values: ['Nendoroid', 'figure'] },
        ];
      }
      return [
        { ...collectionItem(1, 0), series: ['Evangelion'], merchandise_type: 'figure' },
        { ...collectionItem(2, 0), series: ['Gundam'], merchandise_type: 'Nendoroid' },
      ];
    });
    renderHome();
    const optionsOf = label => within(screen.getByRole('combobox', { name: label }))
      .getAllByRole('option')
      .map(option => option.textContent);

    expect(optionsOf('Filter by series')).toEqual(['All Series', 'Gundam', 'Evangelion']);
    expect(optionsOf('Filter by merchandise type')).toEqual(['All Types', 'Nendoroid', 'Figure/Statue']);
    expect(screen.getByRole('link', { name: 'Manage lists' })).toHaveAttribute('href', '/terms');
  });

  it('says how many items an album import added', () => {
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={[{ pathname: '/', state: { importedCount: 2 } }]}>
          <Home />
        </MemoryRouter>
      </LanguageProvider>,
    );

    expect(screen.getByRole('dialog', { name: 'Completed' }))
      .toHaveTextContent('Added 2 item(s). Open each one to fill in the details.');
  });

  it('links the collection and wishlist tabs', () => {
    renderHome();

    const tabs = screen.getByRole('navigation', { name: 'Lists' });
    expect(within(tabs).getByRole('link', { name: 'Collection' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: 'Wishlist' })).toHaveAttribute('href', '/wishlist');
  });
  it('downloads the backup as a dated ZIP file and keeps its address alive for the download', async () => {
    const items = [collectionItem(1, 0)];
    dbMocks.items.toArray.mockResolvedValue(items);
    vi.mocked(useLiveQuery).mockReturnValue(items);
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Export Backup' }));

    await waitFor(() => {
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });
    const link = vi.mocked(HTMLAnchorElement.prototype.click).mock.contexts[0];
    expect(link.download).toMatch(/^acg-backup-\d{4}-\d{2}-\d{2}\.zip$/);
    // Safari reads the file after the click returns, so the address is not revoked at once.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    // A download can be a large file.
    expect(createBackupParts).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      partBytes: 200 * 1024 * 1024,
    }));
  });

  it('says that it is working while a backup is prepared', async () => {
    let finishReading;
    dbMocks.items.toArray.mockReturnValue(new Promise(resolve => { finishReading = resolve; }));
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Export Backup' }));

    expect(await screen.findByText('Working on the backup… Large ones take a while.')).toBeInTheDocument();
    finishReading([collectionItem(1, 0)]);
    await waitFor(() => {
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });
    expect(screen.queryByText(/Working on the backup/)).not.toBeInTheDocument();
  });

  describe('on an iPhone', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      });
      navigator.share = vi.fn().mockResolvedValue(undefined);
      navigator.canShare = vi.fn(() => true);
    });

    afterEach(() => {
      delete navigator.userAgent;
      delete navigator.share;
      delete navigator.canShare;
    });

    // A person needs a few seconds to open the share sheet and close it again.
    const closedByPerson = () => {
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000);
      return Promise.reject(Object.assign(new Error('Share canceled'), { name: 'AbortError' }));
    };

    // What Safari says when it cannot read a file into memory for the share sheet.
    const readError = () => Object.assign(new Error('Abort due to error while reading files.'), { name: 'AbortError' });

    it('saves the backup through the share sheet, opened by a tap once the file is ready', async () => {
      dbMocks.items.toArray.mockResolvedValue([collectionItem(1, 0)]);
      renderHome();

      fireEvent.click(screen.getByRole('button', { name: 'Export Backup' }));

      const ready = await screen.findByRole('dialog', { name: 'Backup ready' });
      expect(ready).toHaveTextContent('Save to Files');
      expect(ready).toHaveTextContent(/acg-backup-\d{4}-\d{2}-\d{2}\.zip/);
      expect(navigator.share).not.toHaveBeenCalled();
      // The share sheet reads the whole file into memory, so its files are smaller.
      expect(createBackupParts).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        partBytes: 100 * 1024 * 1024,
      }));

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(navigator.share).toHaveBeenCalledWith({ files: [expect.any(File)] });
      const [{ files: [file] }] = navigator.share.mock.calls[0];
      expect(file.name).toMatch(/^acg-backup-\d{4}-\d{2}-\d{2}\.zip$/);
      const archive = await readZip(file);
      expect(JSON.parse(await archive.text('backup.json')).items).toEqual([expect.objectContaining({ id: 1 })]);
      expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();

      // The share sheet picks the folder, so the app says how to find the file afterwards.
      const found = await screen.findByRole('dialog', { name: 'Where to find the backup' });
      expect(found).toHaveTextContent('Recents');
      expect(found).toHaveTextContent(file.name);
    });

    it('says nothing more when the share sheet is closed without saving', async () => {
      navigator.share.mockImplementation(closedByPerson);
      renderHome();

      fireEvent.click(screen.getByRole('button', { name: 'Export Backup' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(navigator.share).toHaveBeenCalled();
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    });

    it('downloads the backup when the share sheet refuses the file', async () => {
      navigator.share.mockRejectedValue(Object.assign(new Error('Not allowed'), { name: 'NotAllowedError' }));
      renderHome();

      fireEvent.click(screen.getByRole('button', { name: 'Export Backup' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
      });
      expect(await screen.findByRole('dialog', { name: 'Where to find the backup' }))
        .toHaveTextContent('Downloads folder');
    });

    it('asks before replacing data when the safety backup was not saved', async () => {
      navigator.share.mockImplementation(closedByPerson);
      dbMocks.items.toArray.mockResolvedValue([collectionItem(1, 0)]);
      renderHome();

      const importFile = new File([JSON.stringify({ version: 2, items: [] })], 'backup.json', { type: 'application/json' });
      fireEvent.change(screen.getByLabelText('Import backup file'), { target: { files: [importFile] } });
      fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));

      const unsaved = await screen.findByRole('alertdialog', { name: 'Safety backup not saved' });
      expect(unsaved).toHaveTextContent('Replace them with this backup anyway?');
      expect(navigator.share).toHaveBeenCalledWith({ files: [expect.any(File)] });
      expect(replaceBackupInDb).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(replaceBackupInDb).not.toHaveBeenCalled();

      fireEvent.change(screen.getByLabelText('Import backup file'), { target: { files: [importFile] } });
      fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Replace anyway' }));

      await waitFor(() => {
        expect(replaceBackupInDb).toHaveBeenCalledWith(dbMocks, { items: [], wishlist: undefined, terms: [] });
      });
    });

    describe('with a backup too large for one file', () => {
      beforeEach(() => {
        // Each record makes a file of its own.
        sessionStorage.setItem('acgBackupPartBytes', '1');
        dbMocks.items.toArray.mockResolvedValue([collectionItem(1, 100), collectionItem(2, 100)]);
      });

      afterEach(() => {
        sessionStorage.removeItem('acgBackupPartBytes');
      });

      it('saves it in several files, each from a dialog of its own, then says how to restore them', async () => {
        renderHome();

        fireEvent.click(screen.getByRole('button', { name: 'Export Backup' }));

        const first = await screen.findByRole('dialog', { name: 'Backup file 1 is ready' });
        expect(first).toHaveTextContent('several files');
        expect(first).toHaveTextContent('the next file is prepared');
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        const second = await screen.findByRole('dialog', { name: 'Backup file 2 is ready' });
        expect(second).toHaveTextContent('This is the last file.');
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        const saved = await screen.findByRole('dialog', { name: 'Backup saved in 2 files' });
        expect(saved).toHaveTextContent('choose all 2 files at once');
        const names = navigator.share.mock.calls.map(([{ files: [file] }]) => file.name);
        expect(names).toEqual([
          expect.stringMatching(/^acg-backup-\d{4}-\d{2}-\d{2}-part01\.zip$/),
          expect.stringMatching(/^acg-backup-\d{4}-\d{2}-\d{2}-part02\.zip$/),
        ]);
        const parts = await Promise.all(navigator.share.mock.calls.map(async ([{ files: [file] }]) => (
          JSON.parse(await (await readZip(file)).text('backup.json'))
        )));
        expect(parts.map(part => part.items.map(item => item.id))).toEqual([[1], [2]]);
        expect(parts[1].part).toEqual(expect.objectContaining({ last: true, parts: 2, items: 2 }));
      });

      it('offers a file again when its share sheet is closed, and says the backup is unfinished if stopped', async () => {
        navigator.share
          .mockResolvedValueOnce(undefined)
          .mockImplementationOnce(closedByPerson);
        renderHome();

        fireEvent.click(screen.getByRole('button', { name: 'Export Backup' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
        await screen.findByRole('dialog', { name: 'Backup file 2 is ready' });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        // Closed without saving: the same file is offered again.
        expect(await screen.findByRole('dialog', { name: 'Backup file 2 is ready' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Stop backup' }));

        expect(await screen.findByRole('dialog', { name: 'Backup not finished' }))
          .toHaveTextContent('a restore needs every file');
        expect(navigator.share).toHaveBeenCalledTimes(2);
      });
    });

    describe('when the share sheet cannot take a file', () => {
      beforeEach(() => {
        // Files of three items at first, and at least one item's worth when made smaller.
        sessionStorage.setItem('acgBackupPartBytes', '300');
        sessionStorage.setItem('acgBackupMinPartBytes', '100');
        dbMocks.items.toArray.mockResolvedValue([1, 2, 3, 4].map(id => collectionItem(id, 100)));
      });

      afterEach(() => {
        sessionStorage.removeItem('acgBackupPartBytes');
        sessionStorage.removeItem('acgBackupMinPartBytes');
      });

      const sharedItems = async call => JSON.parse(await (await readZip(call[0].files[0])).text('backup.json'));

      it('makes it again as smaller files, then saves every file of the backup', async () => {
        navigator.share.mockRejectedValueOnce(readError());
        renderHome();

        fireEvent.click(screen.getByRole('button', { name: 'Export Backup' }));
        const first = await screen.findByRole('dialog', { name: 'Backup file 1 is ready' });
        expect(first).not.toHaveTextContent('too large');
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        // Not offered again as it was: file 1 is made again, smaller, and the dialog says why.
        expect(await screen.findByText(/too large for the share sheet/)).toBeInTheDocument();
        expect(screen.getByRole('dialog', { name: 'Backup file 1 is ready' })).toBeInTheDocument();
        for (const number of [1, 2, 3, 4]) {
          if (number > 1) await screen.findByRole('dialog', { name: `Backup file ${number} is ready` });
          fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        }

        const saved = await screen.findByRole('dialog', { name: 'Backup saved in 4 files' });
        expect(saved).toHaveTextContent('choose all 4 files at once');
        const [failed, ...kept] = navigator.share.mock.calls;
        expect((await sharedItems(failed)).items.map(record => record.id)).toEqual([1, 2, 3]);
        const parts = await Promise.all(kept.map(sharedItems));
        expect(parts.map(part => part.items.map(record => record.id))).toEqual([[1], [2], [3], [4]]);
        expect(parts.map(part => part.part.number)).toEqual([1, 2, 3, 4]);
        expect(parts[3].part).toEqual(expect.objectContaining({ last: true, parts: 4, items: 4 }));
        expect(kept.map(call => call[0].files[0].name)).toEqual([1, 2, 3, 4].map(number => (
          expect.stringMatching(new RegExp(`^acg-backup-\\d{4}-\\d{2}-\\d{2}-part0${number}\\.zip$`))
        )));
      });

      it('takes a share sheet that fails at once for a failure, not for a person closing it', async () => {
        navigator.share.mockRejectedValueOnce(Object.assign(new Error('Share canceled'), { name: 'AbortError' }));
        renderHome();

        fireEvent.click(screen.getByRole('button', { name: 'Export Backup' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Save' }));

        expect(await screen.findByText(/too large for the share sheet/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect((await sharedItems(navigator.share.mock.calls[1])).items.map(record => record.id)).toEqual([1]);
      });

      it('stops and says why when even the smallest file cannot be shared', async () => {
        navigator.share.mockRejectedValue(readError());
        renderHome();

        fireEvent.click(screen.getByRole('button', { name: 'Export Backup' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
        await screen.findByText(/too large for the share sheet/);
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        const stopped = await screen.findByRole('dialog', { name: 'Backup could not be shared' });
        expect(stopped).toHaveTextContent('AbortError: Abort due to error while reading files.');
        expect(stopped).toHaveTextContent('a few GB free');
        expect(navigator.share).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole('dialog', { name: /Backup file/ })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Export Backup' })).toBeEnabled();
      });

      it('makes a safety backup smaller too, then restores once all of it is saved', async () => {
        navigator.share.mockRejectedValueOnce(readError());
        renderHome();

        const importFile = new File([JSON.stringify({ version: 2, items: [] })], 'backup.json', { type: 'application/json' });
        fireEvent.change(screen.getByLabelText('Import backup file'), { target: { files: [importFile] } });
        fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));

        expect(await screen.findByText(/too large for the share sheet/)).toBeInTheDocument();
        expect(replaceBackupInDb).not.toHaveBeenCalled();
        for (const number of [1, 2, 3, 4]) {
          await screen.findByRole('dialog', { name: `Safety backup file ${number} is ready` });
          fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        }

        await waitFor(() => {
          expect(replaceBackupInDb).toHaveBeenCalledWith(dbMocks, { items: [], wishlist: undefined, terms: [] });
        });
        expect(navigator.share).toHaveBeenCalledTimes(5);
      });
    });
  });

  describe('restoring a backup saved in several files', () => {
    // Three items with a real, tiny PNG each, saved one item per file.
    async function backupParts() {
      const png = () => new Blob([Uint8Array.from(atob('iVBORw0KGgo='), character => character.charCodeAt(0))], {
        type: 'image/png',
      });
      const files = [];
      const parts = createBackupParts(
        {
          items: [1, 2, 3].map(id => ({ ...collectionItem(id, 0), photos: [png()] })),
          wishlist: [],
          terms: [{ field: 'series', values: ['Current Series', 'Gundam'] }],
        },
        { partBytes: 1 },
      );
      for await (const part of parts) {
        files.push(new File([part.blob], `acg-backup-part0${part.number}.zip`, { type: 'application/zip' }));
      }
      return files;
    }

    it('restores every file chosen at once, in any order', async () => {
      const [first, second, third] = await backupParts();
      renderHome();

      fireEvent.change(screen.getByLabelText('Import backup file'), { target: { files: [third, first, second] } });
      fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));

      await waitFor(() => {
        expect(replaceBackupInDb).toHaveBeenCalledWith(dbMocks, {
          items: [expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 2 }), expect.objectContaining({ id: 3 })],
          wishlist: [],
          // The order of the lists comes back with the last file.
          terms: [{ field: 'series', values: ['Current Series', 'Gundam'] }],
        });
      });
    });

    it('says which files are missing instead of restoring part of the backup', async () => {
      const [first, , third] = await backupParts();
      renderHome();

      fireEvent.change(screen.getByLabelText('Import backup file'), { target: { files: [first, third] } });

      expect(await screen.findByRole('dialog', { name: 'Something went wrong' }))
        .toHaveTextContent('This backup has 3 files. Missing file numbers: 2.');
      expect(replaceBackupInDb).not.toHaveBeenCalled();
    });
  });

  it('clears a filter whose value no longer exists in the collection', async () => {
    vi.mocked(useLiveQuery).mockReturnValue([{
      id: 1,
      series: ['Evangelion'],
      character: ['Asuka'],
      merchandise_type: 'figure',
      photo: null,
    }]);

    const { rerender } = renderHome();
    const seriesFilter = screen.getByRole('combobox', { name: 'Filter by series' });
    fireEvent.change(seriesFilter, { target: { value: 'Evangelion' } });
    expect(seriesFilter).toHaveValue('Evangelion');

    vi.mocked(useLiveQuery).mockReturnValue([{
      id: 2,
      series: ['Gundam'],
      character: ['Char'],
      merchandise_type: 'figure',
      photo: null,
    }]);
    rerender(homeElement());

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Filter by series' })).toHaveValue('all');
    });
    expect(screen.queryByText('No items found')).not.toBeInTheDocument();
  });
});
