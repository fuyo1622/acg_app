import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveQuery } from 'dexie-react-hooks';
import { LanguageProvider } from '../contexts/LanguageContext';
import { takeAlbumFiles } from '../utils/albumHandoff';
import Wishlist from './Wishlist';

const dbMocks = vi.hoisted(() => ({
  items: { toArray: vi.fn() },
  wishlist: {
    toArray: vi.fn(),
    bulkAdd: vi.fn(),
    orderBy: vi.fn(() => ({
      reverse: vi.fn(() => ({
        toArray: vi.fn(),
      })),
    })),
  },
  transaction: vi.fn(async (_mode, _table, callback) => callback()),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}));

vi.mock('../services/db', () => ({
  db: dbMocks,
}));

function renderWishlist(initialEntry = '/wishlist') {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/wishlist/import" element={<p>Album import page</p>} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

function entry(id, fields = {}) {
  return {
    id,
    name: '',
    series: [],
    character: [],
    merchandise_type: '',
    links: [],
    price: null,
    currency: 'JPY',
    shop: '',
    order_deadline: null,
    release: '',
    priority: 'medium',
    status: 'want',
    notes: '',
    photos: [],
    created_at: new Date(`2026-09-0${id}T00:00:00.000Z`),
    updated_at: new Date(`2026-09-0${id}T00:00:00.000Z`),
    ...fields,
  };
}

function image(name) {
  return new File(['image'], name, { type: 'image/png' });
}

describe('Wishlist', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    vi.mocked(useLiveQuery).mockReturnValue([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('opens on the wishlist tab and explains an empty wishlist', () => {
    renderWishlist();

    expect(screen.getByRole('heading', { name: 'Wishlist', level: 1 })).toBeInTheDocument();
    const tabs = screen.getByRole('navigation', { name: 'Lists' });
    expect(within(tabs).getByRole('link', { name: 'Wishlist' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: 'Collection' })).toHaveAttribute('href', '/');
    expect(screen.getByText('Your wishlist is empty')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add to Wishlist' })).toBeInTheDocument();
  });

  it('shows entries with their price, shop, status and priority', () => {
    vi.mocked(useLiveQuery).mockReturnValue([
      entry(1, { name: 'Asuka figure', price: 12800, shop: 'AmiAmi', priority: 'high' }),
      entry(2, { name: 'Rei plush', status: 'ordered' }),
    ]);
    renderWishlist();

    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { name: 'Asuka figure' })).toBeInTheDocument();
    expect(within(main).getByText('¥12,800 · AmiAmi')).toBeInTheDocument();
    expect(within(main).getByText('High priority')).toBeInTheDocument();
    expect(within(main).getByText('Ordered')).toBeInTheDocument();
    expect(within(main).getByRole('link', { name: /Rei plush/ })).toHaveAttribute('href', '/wishlist/item/2');
  });

  it('searches and filters entries, with a distinct message for no matches', () => {
    vi.mocked(useLiveQuery).mockReturnValue([
      entry(1, { name: 'Asuka figure', shop: 'AmiAmi' }),
      entry(2, { name: 'Rei plush', status: 'ordered' }),
    ]);
    renderWishlist();
    const main = screen.getByRole('main');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search wishlist' }), {
      target: { value: 'amiami' },
    });
    expect(within(main).getByRole('heading', { name: 'Asuka figure' })).toBeInTheDocument();
    expect(within(main).queryByRole('heading', { name: 'Rei plush' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), {
      target: { value: 'ordered' },
    });
    expect(screen.getByText('No entries found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search or filters.')).toBeInTheDocument();
  });

  it('opens the album import with the photos chosen here', () => {
    renderWishlist();
    const files = [image('one.png'), image('two.png')];

    fireEvent.change(screen.getByLabelText('Album photos'), { target: { files } });

    expect(screen.getByText('Album import page')).toBeInTheDocument();
    expect(takeAlbumFiles()).toEqual(files);
  });

  it('says how many entries an album import added', () => {
    renderWishlist({ pathname: '/wishlist', state: { importedCount: 3 } });

    expect(screen.getByRole('dialog', { name: 'Completed' }))
      .toHaveTextContent('Added 3 item(s). Open each one to fill in the details.');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Completed' })).not.toBeInTheDocument();
  });
});
