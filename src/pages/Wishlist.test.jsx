import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveQuery } from 'dexie-react-hooks';
import { LanguageProvider } from '../contexts/LanguageContext';
import { compressImage } from '../utils/imageUtils';
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

vi.mock('../utils/imageUtils', () => ({
  compressImage: vi.fn(),
}));

function renderWishlist() {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/wishlist']}>
        <Wishlist />
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
    photo: null,
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
    vi.mocked(compressImage).mockImplementation(file => Promise.resolve(file));
    dbMocks.wishlist.bulkAdd.mockResolvedValue(undefined);
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

  it('adds one entry per chosen screenshot and skips files that are not images', async () => {
    renderWishlist();
    const files = [image('one.png'), image('two.png'), new File(['text'], 'notes.txt', { type: 'text/plain' })];

    fireEvent.change(screen.getByLabelText('Choose screenshots'), { target: { files } });

    expect(await screen.findByRole('dialog', { name: 'Completed' }))
      .toHaveTextContent('Added 2 entries. Open each one to fill in the details.');
    expect(compressImage).toHaveBeenCalledTimes(2);

    const [added] = dbMocks.wishlist.bulkAdd.mock.calls[0];
    expect(added).toHaveLength(2);
    expect(added[0]).toEqual(expect.objectContaining({
      photo: files[0],
      name: '',
      links: [],
      status: 'want',
      currency: 'TWD',
    }));
    // The first pick is the newest, so the batch keeps its picking order.
    expect(added[0].created_at.getTime()).toBeGreaterThan(added[1].created_at.getTime());
  });

  it('limits how many screenshots one batch may add', async () => {
    renderWishlist();
    const files = Array.from({ length: 31 }, (_, index) => image(`${index}.png`));

    fireEvent.change(screen.getByLabelText('Choose screenshots'), { target: { files } });

    expect(await screen.findByRole('dialog', { name: 'Something went wrong' }))
      .toHaveTextContent('Choose up to 30 images at a time.');
    expect(dbMocks.wishlist.bulkAdd).not.toHaveBeenCalled();
  });

  it('reports a failed batch without leaving the button disabled', async () => {
    dbMocks.wishlist.bulkAdd.mockRejectedValueOnce(new Error('QuotaExceededError'));
    renderWishlist();

    fireEvent.change(screen.getByLabelText('Choose screenshots'), { target: { files: [image('one.png')] } });

    expect(await screen.findByRole('dialog', { name: 'Something went wrong' }))
      .toHaveTextContent('Failed to save item. Storage might be full.');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add screenshots' })).toBeEnabled();
    });
  });
});
