import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../contexts/LanguageContext';
import WishlistCard from './WishlistCard';

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

  it('links to the entry and labels a bare screenshot as untitled', () => {
    renderCard(entry({ photo: new Blob(['shot'], { type: 'image/png' }) }));

    expect(screen.getByRole('link')).toHaveAttribute('href', '/wishlist/item/3');
    expect(screen.getByRole('heading', { name: 'Untitled' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Untitled' })).toHaveAttribute('src', 'blob:card');
    expect(screen.getByText('Want')).toBeInTheDocument();
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
