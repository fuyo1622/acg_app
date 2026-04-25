import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveQuery } from 'dexie-react-hooks';
import { LanguageProvider } from '../contexts/LanguageContext';
import { compressImage } from '../utils/imageUtils';
import AddEditItem from './AddEditItem';

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: {},
}));

const dbMocks = vi.hoisted(() => ({
  items: {
    toArray: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

const imageMocks = vi.hoisted(() => ({
  compressImage: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => routerMocks.navigate,
  useParams: () => routerMocks.params,
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}));

vi.mock('../services/db', () => ({
  db: dbMocks,
}));

vi.mock('../utils/imageUtils', () => ({
  compressImage: imageMocks.compressImage,
}));

function renderForm() {
  return render(
    <LanguageProvider>
      <AddEditItem />
    </LanguageProvider>
  );
}

function mockLiveQueries({ allItems = [], editItemQuery } = {}) {
  let editQueryStarted = false;

  vi.mocked(useLiveQuery).mockImplementation((query) => {
    const source = query.toString();

    if (source.includes('db.items.toArray')) {
      return allItems;
    }

    if (editItemQuery && source.includes('db.items.get') && !editQueryStarted) {
      editQueryStarted = true;
      void query();
    }

    return undefined;
  });
}

describe('AddEditItem smoke flows', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    routerMocks.params = {};
    dbMocks.items.add.mockResolvedValue(1);
    dbMocks.items.update.mockResolvedValue(1);
    dbMocks.items.get.mockResolvedValue(undefined);
    imageMocks.compressImage.mockImplementation((file) => Promise.resolve(file));
    vi.stubGlobal('URL', {
      ...globalThis.URL,
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockLiveQueries();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders the add form, blocks invalid submit, and invokes a valid DB add', async () => {
    const { container } = renderForm();

    expect(screen.getByRole('heading', { name: 'New Item' })).toBeInTheDocument();
    expect(screen.getByLabelText('Series / Franchise')).toBeInTheDocument();
    expect(screen.getByLabelText('Character')).toBeInTheDocument();
    expect(screen.getByLabelText('Merchandise Type')).toBeInTheDocument();

    const form = container.querySelector('form');
    fireEvent.submit(form);

    expect(window.alert).toHaveBeenCalledWith('Please enter at least a series or character.');
    expect(dbMocks.items.add).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Series / Franchise'), {
      target: { value: 'Neon Genesis Evangelion' },
    });
    fireEvent.change(screen.getByLabelText('Merchandise Type'), {
      target: { value: 'figure' },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(dbMocks.items.add).toHaveBeenCalledWith(expect.objectContaining({
        series: 'Neon Genesis Evangelion',
        character: '',
        merchandise_type: 'figure',
        notes: '',
        photo: null,
      }));
    });
    expect(routerMocks.navigate).toHaveBeenCalledWith(-1);
  });

  it('edits a restored Blob-backed item without recompressing the existing image', async () => {
    const restoredPhoto = new Blob(['restored image'], { type: 'image/png' });
    const restoredItem = {
      id: 7,
      series: 'Imported Series',
      character: 'Imported Character',
      merchandise_type: 'figure',
      notes: 'Restored from backup',
      photo: restoredPhoto,
    };

    routerMocks.params = { id: '7' };
    dbMocks.items.get.mockResolvedValue(restoredItem);
    mockLiveQueries({ allItems: [restoredItem], editItemQuery: true });

    const { container } = renderForm();

    await screen.findByDisplayValue('Imported Series');
    expect(screen.getByDisplayValue('Imported Character')).toBeInTheDocument();

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      expect(dbMocks.items.update).toHaveBeenCalledWith(7, expect.objectContaining({
        series: 'Imported Series',
        character: 'Imported Character',
        merchandise_type: 'figure',
        notes: 'Restored from backup',
        photo: restoredPhoto,
      }));
    });
    expect(compressImage).not.toHaveBeenCalled();
    expect(routerMocks.navigate).toHaveBeenCalledWith(-1);
  });
});
