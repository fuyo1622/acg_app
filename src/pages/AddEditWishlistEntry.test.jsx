import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveQuery } from 'dexie-react-hooks';
import { LanguageProvider } from '../contexts/LanguageContext';
import { compressImage } from '../utils/imageUtils';
import AddEditWishlistEntry from './AddEditWishlistEntry';

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: {},
}));

const dbMocks = vi.hoisted(() => ({
  items: { toArray: vi.fn() },
  wishlist: {
    toArray: vi.fn(),
    add: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
  transaction: vi.fn(async (_mode, _table, callback) => callback()),
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
  compressImage: vi.fn(),
}));

function renderForm() {
  return render(
    <LanguageProvider>
      <AddEditWishlistEntry />
    </LanguageProvider>,
  );
}

// `editEntry` mirrors the component's contract: `undefined` while the query is in
// flight, `{ entry: null }` once Dexie confirms the id does not exist.
function mockLiveQueries({ collection = [], wishlist = [], editEntry } = {}) {
  vi.mocked(useLiveQuery).mockImplementation((query) => {
    const source = query.toString();

    if (source.includes('db.items.toArray')) return collection;
    if (source.includes('db.wishlist.toArray')) return wishlist;
    if (source.includes('db.wishlist.get')) {
      return editEntry === undefined ? undefined : { entry: editEntry };
    }
    return undefined;
  });
}

function storedEntry(fields = {}) {
  return {
    id: 7,
    name: 'Asuka figure',
    series: ['Evangelion'],
    character: ['Asuka'],
    merchandise_type: 'Nendoroid',
    links: [{ url: 'https://www.amiami.com/item', label: 'AmiAmi' }],
    price: 12800,
    currency: 'JPY',
    shop: 'AmiAmi',
    order_deadline: '2026-10-15',
    release: 'March 2027',
    priority: 'high',
    status: 'ordered',
    notes: 'Bonus postcard',
    photo: null,
    created_at: new Date('2026-09-01T00:00:00.000Z'),
    updated_at: new Date('2026-09-01T00:00:00.000Z'),
    ...fields,
  };
}

describe('AddEditWishlistEntry', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    routerMocks.params = {};
    dbMocks.wishlist.add.mockResolvedValue(1);
    dbMocks.wishlist.update.mockResolvedValue(1);
    dbMocks.wishlist.delete.mockResolvedValue(undefined);
    vi.mocked(compressImage).mockImplementation(file => Promise.resolve(file));
    const TestUrl = class extends globalThis.URL {};
    TestUrl.createObjectURL = vi.fn(() => 'blob:preview');
    TestUrl.revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', TestUrl);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockLiveQueries();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('requires something to recognize the entry by, then saves normalized values', async () => {
    const { container } = renderForm();
    const form = container.querySelector('form');

    expect(screen.getByRole('heading', { name: 'New Wishlist Entry' })).toBeInTheDocument();
    fireEvent.submit(form);
    expect(screen.getByRole('dialog', { name: 'Something went wrong' }))
      .toHaveTextContent('Add a photo, a name, or a link.');
    expect(dbMocks.wishlist.add).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Asuka figure ' } });
    fireEvent.change(screen.getByLabelText('Link 1 address'), {
      target: { value: '預購開始！https://www.amiami.com/item' },
    });
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '12,800' } });
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'JPY' } });
    fireEvent.change(screen.getByLabelText('Order deadline'), { target: { value: '2026-10-15' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(dbMocks.wishlist.add).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Asuka figure',
        links: [{ url: 'https://www.amiami.com/item', label: '' }],
        price: 12800,
        currency: 'JPY',
        order_deadline: '2026-10-15',
        merchandise_type: '',
        status: 'want',
        priority: 'medium',
        photo: null,
      }));
    });
    expect(routerMocks.navigate).toHaveBeenCalledWith('/wishlist', { replace: true });
    expect(localStorage.getItem('wishlistCurrency')).toBe('JPY');
  });

  it('names the link that is not a web address instead of saving', () => {
    const { container } = renderForm();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Asuka figure' } });
    fireEvent.change(screen.getByLabelText('Link 1 address'), { target: { value: 'javascript:alert(1)' } });
    fireEvent.submit(container.querySelector('form'));

    expect(screen.getByRole('dialog', { name: 'Something went wrong' }))
      .toHaveTextContent('This link is not a web address (http or https): javascript:alert(1)');
    expect(dbMocks.wishlist.add).not.toHaveBeenCalled();
  });

  it('adds and removes link rows', () => {
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    expect(screen.getByLabelText('Link 2 address')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove link 1' }));
    expect(screen.queryByLabelText('Link 2 address')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Link 1 address')).toBeInTheDocument();
  });

  it('suggests series already used in the collection', () => {
    mockLiveQueries({
      collection: [{ series: ['Neon Genesis Evangelion'], character: [], merchandise_type: 'figure' }],
    });
    renderForm();

    fireEvent.change(screen.getByRole('combobox', { name: 'Series / Franchise' }), {
      target: { value: 'eva' },
    });
    expect(screen.getByRole('option', { name: 'Neon Genesis Evangelion' })).toBeInTheDocument();
  });

  it('edits an existing entry without recompressing its photo', async () => {
    const photo = new Blob(['screenshot'], { type: 'image/png' });
    const entry = storedEntry({ photo });
    routerMocks.params = { id: '7' };
    mockLiveQueries({ wishlist: [entry], editEntry: entry });

    const { container } = renderForm();

    expect(await screen.findByDisplayValue('Asuka figure')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Edit Wishlist Entry' })).toBeInTheDocument();
    expect(screen.getByLabelText('Link 1 address')).toHaveValue('https://www.amiami.com/item');
    expect(screen.getByLabelText('Link 1 label')).toHaveValue('AmiAmi');
    expect(screen.getByLabelText('Price')).toHaveValue('12800');
    expect(screen.getByLabelText('Merchandise Type')).toHaveValue('Nendoroid');
    expect(screen.getByLabelText('Status')).toHaveValue('ordered');

    fireEvent.click(screen.getByRole('button', { name: 'Remove link 1' }));
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => {
      expect(dbMocks.wishlist.update).toHaveBeenCalledWith(7, expect.objectContaining({
        name: 'Asuka figure',
        links: [],
        merchandise_type: 'Nendoroid',
        status: 'ordered',
        priority: 'high',
        photo,
      }));
    });
    expect(compressImage).not.toHaveBeenCalled();
    expect(routerMocks.navigate).toHaveBeenCalledWith('/wishlist/item/7', { replace: true });
  });

  it('asks before deleting and returns to the wishlist', async () => {
    const entry = storedEntry();
    routerMocks.params = { id: '7' };
    mockLiveQueries({ wishlist: [entry], editEntry: entry });

    renderForm();
    await screen.findByDisplayValue('Asuka figure');
    fireEvent.click(screen.getByRole('button', { name: 'Are you sure you want to delete this wishlist entry?' }));

    expect(screen.getByRole('alertdialog', { name: 'Delete wishlist entry?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(dbMocks.wishlist.delete).toHaveBeenCalledWith(7);
    });
    expect(routerMocks.navigate).toHaveBeenCalledWith('/wishlist', { replace: true });
  });

  it('leaves the edit form when the entry does not exist', async () => {
    routerMocks.params = { id: '99' };
    mockLiveQueries({ editEntry: null });

    renderForm();

    await waitFor(() => {
      expect(routerMocks.navigate).toHaveBeenCalledWith('/wishlist', { replace: true });
    });
  });

  it('treats an id that is not a number as a missing entry instead of querying it', async () => {
    routerMocks.params = { id: 'abc' };
    // IndexedDB rejects NaN as a key, which would reach the error boundary.
    dbMocks.wishlist.get.mockRejectedValue(new DOMException('Not a valid key', 'DataError'));
    let entryQuery;
    vi.mocked(useLiveQuery).mockImplementation((query) => {
      const source = query.toString();
      if (source.includes('db.wishlist.get')) entryQuery = query;
      return source.includes('toArray') ? [] : undefined;
    });

    renderForm();

    await expect(entryQuery()).resolves.toEqual({ entry: null });
    expect(dbMocks.wishlist.get).not.toHaveBeenCalled();
  });
});
