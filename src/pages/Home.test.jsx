import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveQuery } from 'dexie-react-hooks';
import { LanguageProvider } from '../contexts/LanguageContext';
import { replaceItemsInDb } from '../utils/backupUtils';
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
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('renders safely with an empty collection', () => {
    renderHome();

    expect(screen.getByRole('heading', { name: 'My Collection' })).toBeInTheDocument();
    expect(screen.getByText('No items found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters or add a new item.')).toBeInTheDocument();
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

    expect(importInput).toHaveAttribute('accept', '.json');
    fireEvent.click(importButton);

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed backup import without replacing database items', async () => {
    renderHome();

    const importInput = screen.getByLabelText('Import backup file');
    const malformedBackup = new File(['{bad json'], 'backup.json', {
      type: 'application/json',
    });

    fireEvent.change(importInput, {
      target: { files: [malformedBackup] },
    });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Invalid backup file or corrupted payload version.');
    });
    expect(replaceItemsInDb).not.toHaveBeenCalled();
  });
});
