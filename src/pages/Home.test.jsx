import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveQuery } from 'dexie-react-hooks';
import { LanguageProvider } from '../contexts/LanguageContext';
import { replaceItemsInDb } from '../utils/backupUtils';
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
  transaction: vi.fn(),
}));

const backupMocks = vi.hoisted(() => ({
  replaceItemsInDb: vi.fn(),
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
    replaceItemsInDb: backupMocks.replaceItemsInDb,
  };
});

function renderHome() {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </LanguageProvider>
  );
}

describe('Home smoke flows', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    vi.mocked(useLiveQuery).mockReturnValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    dbMocks.items.toArray.mockResolvedValue([]);
    backupMocks.replaceItemsInDb.mockResolvedValue(undefined);
    vi.stubGlobal('URL', {
      ...globalThis.URL,
      createObjectURL: vi.fn(() => 'blob:backup'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
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
    expect(replaceItemsInDb).not.toHaveBeenCalled();
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
    expect(await screen.findByRole('alertdialog', { name: 'Import Backup' }))
      .toHaveTextContent('safety backup');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
      expect(replaceItemsInDb).toHaveBeenCalledWith(dbMocks, [
        expect.objectContaining({
          id: 2,
          series: ['Imported Series'],
          character: [],
          merchandise_type: 'plush',
        }),
      ]);
    });
  });
});
