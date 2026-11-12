import '@testing-library/jest-dom/vitest';
import { StrictMode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../contexts/LanguageContext';
import { getCardImage } from '../services/thumbnails';
import ItemCard from './ItemCard';

vi.mock('../services/thumbnails', () => ({
  getCardImage: vi.fn(),
}));

const smallCopy = new Blob(['small'], { type: 'image/jpeg' });

function renderCard(item) {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <ItemCard item={item} />
      </MemoryRouter>
    </LanguageProvider>
  );
}

describe('ItemCard', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    vi.mocked(getCardImage).mockResolvedValue(smallCopy);
    vi.stubGlobal('URL', {
      ...globalThis.URL,
      createObjectURL: vi.fn(() => 'blob:card'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('links to the item and joins multiple values with the language separator', () => {
    renderCard({
      id: 12,
      series: ['Evangelion', 'Rebuild of Evangelion'],
      character: ['Asuka', 'Rei'],
      merchandise_type: 'figure',
      photo: null,
    });

    expect(screen.getByRole('link')).toHaveAttribute('href', '/item/12');
    expect(screen.getByRole('heading', { name: 'Asuka, Rei' })).toBeInTheDocument();
    expect(screen.getByText('Evangelion, Rebuild of Evangelion')).toBeInTheDocument();
    expect(screen.getByText('Figure/Statue')).toBeInTheDocument();
  });

  it('shows a custom type as entered and falls back when values are missing', () => {
    renderCard({ id: 3, series: [], character: [], merchandise_type: 'Nendoroid', photo: null });

    expect(screen.getByRole('heading', { name: 'Unknown Character' })).toBeInTheDocument();
    expect(screen.getByText('Unknown Series')).toBeInTheDocument();
    expect(screen.getByText('Nendoroid')).toBeInTheDocument();
    expect(screen.getByText('No Photo')).toBeInTheDocument();
  });

  it('renders a photo through an object URL with descriptive alt text', async () => {
    renderCard({
      id: 4,
      series: ['Gundam'],
      character: ['Char'],
      merchandise_type: 'plush',
      photo: new Blob(['photo'], { type: 'image/webp' }),
    });

    const image = await screen.findByRole('img', { name: 'Char' });
    expect(image).toHaveAttribute('src', 'blob:card');
    expect(image).toHaveAttribute('loading', 'lazy');
  });

  it('marks an item that needs details and hides an empty type', () => {
    renderCard({ id: 5, series: [], character: [], merchandise_type: '', photos: [] });

    expect(screen.getByText('Needs details')).toBeInTheDocument();
    expect(screen.queryByText('Figure/Statue')).not.toBeInTheDocument();
    expect(screen.getByRole('link').querySelectorAll('.item-badge')).toHaveLength(1);
  });

  it('shows a small copy of the cover, never the full photo, and how many photos there are', async () => {
    const photos = [new Blob(['front'], { type: 'image/png' }), new Blob(['back'], { type: 'image/png' })];
    const item = { id: 6, series: ['Evangelion'], character: ['Asuka'], merchandise_type: 'figure', photos };
    renderCard(item);

    expect(await screen.findByRole('img', { name: 'Asuka' })).toHaveAttribute('src', 'blob:card');
    expect(getCardImage).toHaveBeenCalledWith('items', item, photos[0], expect.objectContaining({
      signal: expect.any(AbortSignal),
    }));
    // Compared by identity: to the matchers, any two Blobs look equal.
    expect(vi.mocked(URL.createObjectURL).mock.calls.map(([blob]) => blob)).toEqual([expect.any(Blob)]);
    expect(vi.mocked(URL.createObjectURL).mock.calls[0][0]).toBe(smallCopy);
    expect(screen.getByRole('img', { name: '2 photos' })).toHaveTextContent('2');
    expect(screen.queryByText('Needs details')).not.toBeInTheDocument();
  });

  it('shows the photo itself while its small copy is made, then the copy in the same image', async () => {
    const photo = new Blob(['full size'], { type: 'image/jpeg' });
    vi.mocked(URL.createObjectURL).mockImplementation(blob => (blob === smallCopy ? 'blob:small' : 'blob:photo'));
    let finishCopy;
    vi.mocked(getCardImage).mockImplementation((storeName, record, cover, { onWait }) => {
      onWait();
      return new Promise((resolve) => {
        finishCopy = () => resolve(smallCopy);
      });
    });
    renderCard({ id: 10, series: ['Gundam'], photos: [photo] });

    const image = await screen.findByRole('img', { name: 'Gundam' });
    expect(image).toHaveAttribute('src', 'blob:photo');
    expect(vi.mocked(URL.createObjectURL).mock.calls[0][0]).toBe(photo);

    const removeSource = vi.spyOn(image, 'removeAttribute');
    finishCopy();

    await waitFor(() => expect(image).toHaveAttribute('src', 'blob:small'));
    expect(screen.getByRole('img', { name: 'Gundam' })).toBe(image);
    // Swapped in place: the photo stays on screen until the copy replaces it.
    expect(removeSource).not.toHaveBeenCalled();
  });

  it('keeps its image through the extra mount React does in development', async () => {
    render(
      <StrictMode>
        <LanguageProvider>
          <MemoryRouter>
            <ItemCard item={{ id: 9, series: ['Gundam'], photos: [new Blob(['photo'], { type: 'image/png' })] }} />
          </MemoryRouter>
        </LanguageProvider>
      </StrictMode>,
    );

    expect(await screen.findByRole('img', { name: 'Gundam' })).toHaveAttribute('src', 'blob:card');
  });

  it('lets go of its image as soon as it is removed', async () => {
    const { unmount } = renderCard({ id: 8, series: ['Gundam'], photos: [new Blob(['photo'], { type: 'image/png' })] });
    const image = await screen.findByRole('img', { name: 'Gundam' });
    expect(image).toHaveAttribute('src', 'blob:card');

    unmount();

    expect(image).not.toHaveAttribute('src');
  });

  it('stops waiting for its small copy once it leaves the screen', () => {
    vi.mocked(getCardImage).mockReturnValue(new Promise(() => {}));
    const { unmount } = renderCard({ id: 7, series: ['Gundam'], photos: [new Blob(['photo'], { type: 'image/png' })] });
    const [, , , { signal }] = vi.mocked(getCardImage).mock.calls[0];

    expect(signal.aborted).toBe(false);
    expect(screen.queryByRole('img', { name: 'Gundam' })).not.toBeInTheDocument();
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
