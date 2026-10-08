import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveQuery } from 'dexie-react-hooks';
import { LanguageProvider } from '../contexts/LanguageContext';
import WishlistDetail from './WishlistDetail';

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { id: '7' },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => routerMocks.navigate,
  useParams: () => routerMocks.params,
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}));

vi.mock('../services/db', () => ({
  db: { wishlist: { get: vi.fn() } },
}));

function renderDetail() {
  return render(
    <LanguageProvider>
      <WishlistDetail />
    </LanguageProvider>,
  );
}

function entry(fields = {}) {
  return {
    id: 7,
    name: 'Asuka figure',
    series: ['Evangelion'],
    character: ['Asuka'],
    merchandise_type: 'figure',
    links: [
      { url: 'https://www.amiami.com/item', label: 'AmiAmi' },
      { url: 'https://x.com/post/1', label: '' },
    ],
    price: 12800,
    currency: 'JPY',
    shop: 'Mandarake',
    order_deadline: '2026-09-30',
    release: 'March 2027',
    priority: 'high',
    status: 'want',
    notes: 'Bonus postcard',
    photo: null,
    created_at: new Date('2026-09-01T00:00:00.000Z'),
    ...fields,
  };
}

describe('WishlistDetail', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    routerMocks.params = { id: '7' };
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 1, 12));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('shows a not-found state that returns to the wishlist', () => {
    vi.mocked(useLiveQuery).mockReturnValue(null);
    renderDetail();

    expect(screen.getByText('This wishlist entry does not exist or has already been deleted.'))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to wishlist' }));
    expect(routerMocks.navigate).toHaveBeenCalledWith('/wishlist');
  });

  it('shows the details and an overdue order deadline', () => {
    vi.mocked(useLiveQuery).mockReturnValue(entry());
    renderDetail();

    expect(screen.getByRole('heading', { name: 'Asuka figure', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Want')).toBeInTheDocument();
    expect(screen.getByText('¥12,800')).toBeInTheDocument();
    expect(screen.getByText('Mandarake')).toBeInTheDocument();
    expect(screen.getByText('Deadline passed (Sep 30)')).toHaveClass('deadline-overdue');
    expect(screen.getByText('March 2027')).toBeInTheDocument();
    expect(screen.getByText('Figure/Statue')).toBeInTheDocument();
    expect(screen.getByText('Bonus postcard')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Wishlist Entry' }));
    expect(routerMocks.navigate).toHaveBeenCalledWith('/wishlist/edit/7');
  });

  it('stops warning about the deadline once the entry is ordered', () => {
    vi.mocked(useLiveQuery).mockReturnValue(entry({ status: 'ordered' }));
    renderDetail();

    expect(screen.getByText('Sep 30')).not.toHaveClass('deadline-overdue');
    expect(screen.queryByText(/Deadline passed/)).not.toBeInTheDocument();
  });

  it('opens links in a new tab without sharing the app as referrer', () => {
    vi.mocked(useLiveQuery).mockReturnValue(entry());
    renderDetail();

    const shopLink = screen.getByRole('link', { name: /AmiAmi/ });
    expect(shopLink).toHaveAttribute('href', 'https://www.amiami.com/item');
    expect(shopLink).toHaveAttribute('target', '_blank');
    expect(shopLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(shopLink).toHaveTextContent('(opens in a new tab)');
    expect(screen.getByRole('link', { name: /x\.com/ })).toHaveAttribute('href', 'https://x.com/post/1');
  });

  it('never renders a stored link that is not a web address', () => {
    vi.mocked(useLiveQuery).mockReturnValue(entry({
      links: [{ url: 'javascript:alert(1)', label: 'Planted' }],
    }));
    renderDetail();

    expect(screen.queryByText('Planted')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('expands a tall screenshot to its full height on request', () => {
    const TestUrl = class extends globalThis.URL {};
    TestUrl.createObjectURL = vi.fn(() => 'blob:detail');
    TestUrl.revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', TestUrl);
    vi.mocked(useLiveQuery).mockReturnValue(entry({ photo: new Blob(['shot'], { type: 'image/png' }) }));
    renderDetail();

    const toggle = screen.getByRole('button', { name: 'Show the whole image' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});
