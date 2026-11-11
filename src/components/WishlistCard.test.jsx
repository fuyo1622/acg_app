import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../contexts/LanguageContext';
import { getCardImage } from '../services/thumbnails';
import WishlistCard from './WishlistCard';

vi.mock('../services/thumbnails', () => ({
  getCardImage: vi.fn(),
}));

const smallCopy = new Blob(['small'], { type: 'image/jpeg' });

function renderCard(entry) {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <WishlistCard entry={entry} />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

function entry(fields = {}) {
  return {
    id: 3,
    name: '',
    series: [],
    character: [],
    links: [],
    price: null,
    currency: 'TWD',
    shop: '',
    order_deadline: null,
    priority: 'medium',
    status: 'want',
    photo: null,
    ...fields,
  };
}

describe('WishlistCard', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 1, 12));
    const TestUrl = class extends globalThis.URL {};
    TestUrl.createObjectURL = vi.fn(() => 'blob:card');
    TestUrl.revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', TestUrl);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('links to the entry and labels a bare screenshot as untitled', async () => {
    vi.mocked(getCardImage).mockResolvedValue(smallCopy);
    renderCard(entry({ photo: new Blob(['shot'], { type: 'image/png' }) }));

    expect(screen.getByRole('link')).toHaveAttribute('href', '/wishlist/item/3');
    expect(screen.getByRole('heading', { name: 'Untitled' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: 'Untitled' })).toHaveAttribute('src', 'blob:card');
    expect(getCardImage).toHaveBeenCalledWith('wishlist', expect.objectContaining({ id: 3 }), expect.any(Blob), expect.any(AbortSignal));
    expect(vi.mocked(URL.createObjectURL).mock.calls[0][0]).toBe(smallCopy);
    expect(screen.getByText('Want')).toBeInTheDocument();
  });

  it('lets go of its image as soon as it is removed', async () => {
    vi.mocked(getCardImage).mockResolvedValue(smallCopy);
    const { unmount } = renderCard(entry({ photo: new Blob(['shot'], { type: 'image/png' }) }));
    const image = await screen.findByRole('img', { name: 'Untitled' });
    expect(image).toHaveAttribute('src', 'blob:card');

    unmount();

    expect(image).not.toHaveAttribute('src');
  });

  it('shows price, shop, priority and an approaching deadline', () => {
    renderCard(entry({
      name: 'Asuka figure',
      series: ['Evangelion'],
      price: 1200,
      shop: 'Animate',
      priority: 'high',
      order_deadline: '2026-10-05',
    }));

    expect(screen.getByRole('heading', { name: 'Asuka figure' })).toBeInTheDocument();
    expect(screen.getByText('Evangelion')).toBeInTheDocument();
    expect(screen.getByText('NT$1,200 · Animate')).toBeInTheDocument();
    expect(screen.getByText('High priority')).toBeInTheDocument();
    expect(screen.getByText('Order by Oct 5')).toHaveClass('deadline-soon');
  });

  it('drops the deadline once the entry has been ordered', () => {
    renderCard(entry({ name: 'Rei plush', status: 'ordered', order_deadline: '2026-09-01' }));

    expect(screen.getByText('Ordered')).toBeInTheDocument();
    expect(screen.queryByText(/Deadline passed/)).not.toBeInTheDocument();
  });
});
