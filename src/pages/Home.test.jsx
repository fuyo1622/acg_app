import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveQuery } from 'dexie-react-hooks';
import { LanguageProvider } from '../contexts/LanguageContext';
import { replaceBackupInDb } from '../utils/backupUtils';
import { APP_RELEASE_URL, APP_VERSION } from '../utils/version';
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
    photo,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function readBlobText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
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
    photo: null,
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

// Each photo stays under the per-photo limit; together they pass the 50 MiB file limit.
function oversizedCollection() {
  return Array.from({ length: 8 }, (_, index) => collectionItem(index + 1, 8 * 1024 * 1024));
}

describe('Home smoke flows', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    vi.mocked(useLiveQuery).mockReturnValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    dbMocks.items.toArray.mockResolvedValue([]);
    dbMocks.wishlist.toArray.mockResolvedValue([]);
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

    expect(importInput).toHaveAttribute('accept', 'application/json,.json');
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
    const [backupBlob] = vi.mocked(URL.createObjectURL).mock.calls
      .map(([blob]) => blob)
      .filter(blob => blob.type === 'application/json');
    const exported = JSON.parse(await readBlobText(backupBlob));
    expect(exported.version).toBe(3);
    expect(exported.items).toHaveLength(1);
    expect(exported.wishlist).toEqual([expect.objectContaining({ id: 5, name: 'Rei plush' })]);
  });

  it('links the collection and wishlist tabs', () => {
    renderHome();

    const tabs = screen.getByRole('navigation', { name: 'Lists' });
    expect(within(tabs).getByRole('link', { name: 'Collection' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: 'Wishlist' })).toHaveAttribute('href', '/wishlist');
  });
  it('warns before exporting a backup that exceeds the import limit', async () => {
    const items = oversizedCollection();
    dbMocks.items.toArray.mockResolvedValue(items);
    vi.mocked(useLiveQuery).mockReturnValue(items);
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Export Backup' }));

    const warning = await screen.findByRole('dialog', { name: 'Large backup' });
    expect(warning).toHaveTextContent('larger than the import limit');
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });
  });

  it('exports a collection within the limit without a warning', async () => {
    const items = [collectionItem(1, 0)];
    dbMocks.items.toArray.mockResolvedValue(items);
    vi.mocked(useLiveQuery).mockReturnValue(items);
    renderHome();

    fireEvent.click(screen.getByRole('button', { name: 'Export Backup' }));

    await waitFor(() => {
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog', { name: 'Large backup' })).not.toBeInTheDocument();
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
