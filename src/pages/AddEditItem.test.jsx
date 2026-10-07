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

// `editItem` mirrors the component's own contract: `undefined` while the query is in
// flight, `{ item: null }` once Dexie confirms the id does not exist.
function mockLiveQueries({ allItems = [], editItem } = {}) {
  vi.mocked(useLiveQuery).mockImplementation((query) => {
    const source = query.toString();

    if (source.includes('db.items.toArray')) {
      return allItems;
    }

    if (source.includes('db.items.get')) {
      return editItem === undefined ? undefined : { item: editItem };
    }

    return undefined;
  });
}

function addNewMultiValue(label, value) {
  fireEvent.change(screen.getByRole('combobox', { name: label }), {
    target: { value },
  });
  fireEvent.click(screen.getByRole('option', { name: `Add "${value}"` }));
}

describe('AddEditItem smoke flows', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    routerMocks.params = {};
    dbMocks.items.add.mockResolvedValue(1);
    dbMocks.items.update.mockResolvedValue(1);
    dbMocks.items.get.mockResolvedValue(undefined);
    dbMocks.items.delete.mockResolvedValue(undefined);
    imageMocks.compressImage.mockImplementation((file) => Promise.resolve(file));
    vi.stubGlobal('URL', {
      ...globalThis.URL,
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    });
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

    expect(screen.getByRole('dialog', { name: 'Something went wrong' }))
      .toHaveTextContent('Please enter at least a series or character.');
    expect(dbMocks.items.add).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    addNewMultiValue('Series / Franchise', 'Neon Genesis Evangelion');
    fireEvent.change(screen.getByLabelText('Merchandise Type'), {
      target: { value: 'figure' },
    });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(dbMocks.items.add).toHaveBeenCalledWith(expect.objectContaining({
        series: ['Neon Genesis Evangelion'],
        character: [],
        merchandise_type: 'figure',
        notes: '',
        photo: null,
      }));
    });
    expect(routerMocks.navigate).toHaveBeenCalledWith('/', { replace: true });
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
    mockLiveQueries({ allItems: [restoredItem], editItem: restoredItem });

    const { container } = renderForm();

    expect(await screen.findByText('Imported Series')).toBeInTheDocument();
    expect(screen.getByText('Imported Character')).toBeInTheDocument();

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      expect(dbMocks.items.update).toHaveBeenCalledWith(7, expect.objectContaining({
        series: ['Imported Series'],
        character: ['Imported Character'],
        merchandise_type: 'figure',
        notes: 'Restored from backup',
        photo: restoredPhoto,
      }));
    });
    expect(compressImage).not.toHaveBeenCalled();
    expect(routerMocks.navigate).toHaveBeenCalledWith('/item/7', { replace: true });
  });

  it('shows matching options in the dropdown and saves multiple selected values', async () => {
    mockLiveQueries({
      allItems: [
        { series: ['Neon Genesis Evangelion'], character: ['Asuka'], merchandise_type: 'figure' },
        { series: ['Evangelion: 3.0+1.0'], character: ['Rei'], merchandise_type: 'figure' },
        { series: ['Gundam'], character: ['Char'], merchandise_type: 'figure' },
      ],
    });

    const { container } = renderForm();
    const seriesInput = screen.getByRole('combobox', { name: 'Series / Franchise' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.change(seriesInput, { target: { value: 'eva' } });

    expect(screen.getByRole('option', { name: 'Neon Genesis Evangelion' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Evangelion: 3.0+1.0' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Gundam' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: 'Neon Genesis Evangelion' }));
    fireEvent.change(seriesInput, { target: { value: '3.0' } });
    fireEvent.click(screen.getByRole('option', { name: 'Evangelion: 3.0+1.0' }));
    fireEvent.change(screen.getByLabelText('Merchandise Type'), {
      target: { value: 'figure' },
    });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      expect(dbMocks.items.add).toHaveBeenCalledWith(expect.objectContaining({
        series: ['Neon Genesis Evangelion', 'Evangelion: 3.0+1.0'],
        character: [],
      }));
    });
  });

  it('asks for confirmation before deleting and reports delete failures', async () => {
    const restoredItem = {
      id: 7,
      series: ['Imported Series'],
      character: ['Imported Character'],
      merchandise_type: 'figure',
      photo: null,
    };
    routerMocks.params = { id: '7' };
    dbMocks.items.get.mockResolvedValue(restoredItem);
    dbMocks.items.delete.mockRejectedValueOnce(new Error('delete failed'));
    mockLiveQueries({ allItems: [restoredItem], editItem: restoredItem });

    renderForm();
    await screen.findByText('Imported Series');
    fireEvent.click(screen.getByRole('button', { name: 'Are you sure you want to delete this item?' }));

    expect(screen.getByRole('alertdialog', { name: 'Delete item?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(dbMocks.items.delete).toHaveBeenCalledWith(7);
      expect(screen.getByRole('dialog', { name: 'Something went wrong' }))
        .toHaveTextContent('Failed to delete this item.');
    });
  });
  it('selects an existing custom type instead of falling back to the free-text field', async () => {
    const customItem = {
      id: 7,
      series: ['Imported Series'],
      character: ['Imported Character'],
      merchandise_type: 'Nendoroid',
      photo: null,
    };
    routerMocks.params = { id: '7' };
    dbMocks.items.get.mockResolvedValue(customItem);
    mockLiveQueries({ allItems: [customItem], editItem: customItem });

    renderForm();
    await screen.findByText('Imported Series');

    expect(screen.getByLabelText('Merchandise Type')).toHaveValue('Nendoroid');
    expect(screen.queryByPlaceholderText('Type to search or add...')).not.toBeInTheDocument();
  });

  it('leaves the edit form when the requested item does not exist', async () => {
    routerMocks.params = { id: '99' };
    dbMocks.items.get.mockResolvedValue(undefined);
    mockLiveQueries({ allItems: [], editItem: null });

    renderForm();

    await waitFor(() => {
      expect(routerMocks.navigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('treats an id that is not a number as a missing item instead of querying it', async () => {
    routerMocks.params = { id: 'abc' };
    // IndexedDB rejects NaN as a key, which would reach the error boundary.
    dbMocks.items.get.mockRejectedValue(new DOMException('Not a valid key', 'DataError'));
    let itemQuery;
    vi.mocked(useLiveQuery).mockImplementation((query) => {
      const source = query.toString();
      if (source.includes('db.items.get')) itemQuery = query;
      return source.includes('db.items.toArray') ? [] : undefined;
    });

    renderForm();

    await expect(itemQuery()).resolves.toEqual({ item: null });
    expect(dbMocks.items.get).not.toHaveBeenCalled();
  });
});
