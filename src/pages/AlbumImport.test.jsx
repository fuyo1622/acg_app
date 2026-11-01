import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../contexts/LanguageContext';
import { handOffAlbumFiles, takeAlbumFiles } from '../utils/albumHandoff';
import { compressImage, createThumbnail } from '../utils/imageUtils';
import AlbumImport from './AlbumImport';

const dbMocks = vi.hoisted(() => ({
  items: { bulkAdd: vi.fn() },
  wishlist: { bulkAdd: vi.fn() },
  transaction: vi.fn(async (_mode, _table, callback) => callback()),
}));

vi.mock('../services/db', () => ({
  db: dbMocks,
}));

vi.mock('../utils/imageUtils', () => ({
  compressImage: vi.fn(),
  createThumbnail: vi.fn(),
}));

function image(name) {
  return new File([name], `${name}.png`, { type: 'image/png' });
}

function ListPage({ name }) {
  const location = useLocation();
  const count = location.state?.importedCount;
  return <p>{name} page{count ? `, imported ${count}` : ''}</p>;
}

function renderImport(path = '/import') {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<ListPage name="Collection" />} />
          <Route path="/import" element={<AlbumImport target="collection" />} />
          <Route path="/wishlist" element={<ListPage name="Wishlist" />} />
          <Route path="/wishlist/import" element={<AlbumImport target="wishlist" />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

const tiles = () => screen.getAllByRole('button', { name: /^Item \d+:/ });

describe('AlbumImport', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    vi.mocked(compressImage).mockImplementation(file => Promise.resolve(file));
    vi.mocked(createThumbnail).mockImplementation(photo => Promise.resolve(photo));
    dbMocks.items.bulkAdd.mockResolvedValue(undefined);
    dbMocks.wishlist.bulkAdd.mockResolvedValue(undefined);
    let counter = 0;
    const TestUrl = class extends globalThis.URL {};
    TestUrl.createObjectURL = vi.fn(() => `blob:photo-${(counter += 1)}`);
    TestUrl.revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', TestUrl);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    takeAlbumFiles();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('turns each photo into an unfinished collection item, merged where the user chooses', async () => {
    const photos = [image('front'), image('back'), image('box')];
    handOffAlbumFiles([...photos, new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    renderImport();

    expect(await screen.findAllByRole('button', { name: /^Item \d+: 1 photo/ })).toHaveLength(3);
    expect(compressImage).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole('button', { name: 'Item 1: 1 photo(s)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Item 3: 1 photo(s)' }));
    expect(screen.getByRole('button', { name: 'Item 1: 1 photo(s)' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    expect(tiles().map(tile => tile.getAttribute('aria-label')))
      .toEqual(['Item 1: 2 photo(s)', 'Item 2: 1 photo(s)']);

    fireEvent.click(screen.getByRole('button', { name: 'Add all (2)' }));

    expect(await screen.findByText('Collection page, imported 2')).toBeInTheDocument();
    expect(dbMocks.transaction).toHaveBeenCalledWith('rw', dbMocks.items, expect.any(Function));
    const [records] = dbMocks.items.bulkAdd.mock.calls[0];
    expect(records).toEqual([
      expect.objectContaining({ photos: [photos[0], photos[2]], series: [], character: [], merchandise_type: '', notes: '' }),
      expect.objectContaining({ photos: [photos[1]] }),
    ]);
    // The first tile is the newest, so the import keeps its order on the list.
    expect(records[0].created_at.getTime()).toBeGreaterThan(records[1].created_at.getTime());
  });

  it('splits a merged item and leaves out photos the user removes', async () => {
    handOffAlbumFiles([image('a'), image('b'), image('c')]);
    renderImport();
    await screen.findAllByRole('button', { name: /^Item \d+:/ });

    fireEvent.click(screen.getByRole('button', { name: 'Item 1: 1 photo(s)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Item 2: 1 photo(s)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));
    expect(tiles()).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Item 1: 2 photo(s)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Split' }));
    expect(tiles()).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Item 3: 1 photo(s)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(tiles()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Add all (2)' })).toBeEnabled();
  });

  it('adds wishlist entries in the currency the user last chose', async () => {
    localStorage.setItem('wishlistCurrency', 'JPY');
    const photos = [image('shop'), image('price')];
    handOffAlbumFiles(photos);
    renderImport('/wishlist/import');
    await screen.findAllByRole('button', { name: /^Item \d+:/ });

    fireEvent.click(screen.getByRole('button', { name: 'Add all (2)' }));

    expect(await screen.findByText('Wishlist page, imported 2')).toBeInTheDocument();
    const [entries] = dbMocks.wishlist.bulkAdd.mock.calls[0];
    expect(entries[0]).toEqual(expect.objectContaining({
      photos: [photos[0]],
      name: '',
      currency: 'JPY',
      status: 'want',
      links: [],
    }));
    expect(dbMocks.items.bulkAdd).not.toHaveBeenCalled();
  });

  it('refuses more than 100 photos, and files that are not images', async () => {
    handOffAlbumFiles(Array.from({ length: 101 }, (_, index) => image(`p${index}`)));
    renderImport();

    expect(await screen.findByRole('dialog', { name: 'Something went wrong' }))
      .toHaveTextContent('An import holds up to 100 photos.');
    expect(compressImage).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.change(screen.getByLabelText('Album photos'), {
      target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] },
    });
    expect(await screen.findByRole('dialog', { name: 'Something went wrong' }))
      .toHaveTextContent('None of the chosen files is an image.');
  });

  it('adds photos from another round to the same import, within one limit', async () => {
    const photos = [image('front'), image('back'), image('box')];
    handOffAlbumFiles(photos.slice(0, 2));
    renderImport();
    await screen.findAllByRole('button', { name: /^Item \d+:/ });
    fireEvent.click(screen.getByRole('button', { name: 'Item 1: 1 photo(s)' }));

    fireEvent.change(screen.getByLabelText('Album photos'), { target: { files: [photos[2]] } });

    await waitFor(() => {
      expect(tiles()).toHaveLength(3);
    });
    // Tiles and the selection from the first round stay; the new photo joins the end.
    expect(screen.getByRole('button', { name: 'Item 1: 1 photo(s)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Add photos' })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Album photos'), {
      target: { files: Array.from({ length: 98 }, (_, index) => image(`p${index}`)) },
    });
    expect(await screen.findByRole('dialog', { name: 'Something went wrong' }))
      .toHaveTextContent('An import holds up to 100 photos, so you can add 97 more.');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(tiles()).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Add all (3)' }));
    await screen.findByText('Collection page, imported 3');
    const [records] = dbMocks.items.bulkAdd.mock.calls[0];
    expect(records.map(record => record.photos)).toEqual(photos.map(photo => [photo]));
  });

  it('stops offering more photos once an import holds 100', async () => {
    handOffAlbumFiles(Array.from({ length: 100 }, (_, index) => image(`p${index}`)));
    renderImport();

    expect(await screen.findAllByRole('button', { name: /^Item \d+:/ })).toHaveLength(100);
    expect(screen.queryByRole('button', { name: 'Add photos' })).not.toBeInTheDocument();
  });

  it('shows small thumbnails on the tiles but saves the full photos', async () => {
    const thumbnails = new Map();
    vi.mocked(createThumbnail).mockImplementation(photo => {
      const thumbnail = new Blob([`small ${photo.name}`], { type: 'image/jpeg' });
      thumbnails.set(photo, thumbnail);
      return Promise.resolve(thumbnail);
    });
    const photos = [image('front'), image('back')];
    handOffAlbumFiles(photos);
    renderImport();
    await screen.findAllByRole('button', { name: /^Item \d+:/ });

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalledWith(thumbnails.get(photos[0]));
    });
    expect(URL.createObjectURL).not.toHaveBeenCalledWith(photos[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Add all (2)' }));
    await screen.findByText('Collection page, imported 2');
    const [records] = dbMocks.items.bulkAdd.mock.calls[0];
    expect(records.map(record => record.photos)).toEqual([[photos[0]], [photos[1]]]);
  });

  it('keeps one item to 10 photos when merging', async () => {
    handOffAlbumFiles(Array.from({ length: 11 }, (_, index) => image(`p${index}`)));
    renderImport();
    await screen.findAllByRole('button', { name: /^Item \d+:/ });

    tiles().forEach(tile => fireEvent.click(tile));
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }));

    expect(screen.getByRole('dialog', { name: 'Something went wrong' }))
      .toHaveTextContent('An item can hold up to 10 photos.');
    expect(tiles()).toHaveLength(11);
  });

  it('keeps the photos for another try when saving fails', async () => {
    dbMocks.items.bulkAdd.mockRejectedValueOnce(new Error('QuotaExceededError'));
    handOffAlbumFiles([image('a')]);
    renderImport();
    await screen.findAllByRole('button', { name: /^Item \d+:/ });

    fireEvent.click(screen.getByRole('button', { name: 'Add all (1)' }));

    expect(await screen.findByRole('dialog', { name: 'Something went wrong' }))
      .toHaveTextContent('Failed to save item. Storage might be full.');
    expect(tiles()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Add all (1)' })).toBeEnabled();
  });

  it('asks before discarding the chosen photos', async () => {
    handOffAlbumFiles([image('a')]);
    renderImport();
    await screen.findAllByRole('button', { name: /^Item \d+:/ });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('alertdialog', { name: 'Discard this import?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(tiles()).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.getByText('Collection page')).toBeInTheDocument();
    expect(dbMocks.items.bulkAdd).not.toHaveBeenCalled();
  });

  it('lets the user choose photos when the page is opened directly', async () => {
    renderImport();

    expect(screen.getByRole('button', { name: 'Choose photos' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Album photos'), { target: { files: [image('a'), image('b')] } });

    await waitFor(() => {
      expect(tiles()).toHaveLength(2);
    });
  });
});
