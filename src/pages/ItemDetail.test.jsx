import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveQuery } from 'dexie-react-hooks';
import { LanguageProvider } from '../contexts/LanguageContext';
import ItemDetail from './ItemDetail';

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { id: '7' },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => routerMocks.navigate,
  useParams: () => routerMocks.params,
  useLocation: () => routerMocks.location ?? { state: null },
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}));

vi.mock('../services/db', () => ({
  db: { items: { get: vi.fn() } },
}));

describe('ItemDetail', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    routerMocks.params = { id: '7' };
    routerMocks.location = { state: null };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a stable not-found state instead of permanent loading', () => {
    vi.mocked(useLiveQuery).mockReturnValue(null);
    render(
      <LanguageProvider>
        <ItemDetail />
      </LanguageProvider>,
    );

    expect(screen.getByText('This item does not exist or has already been deleted.'))
      .toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to collection' }));
    expect(routerMocks.navigate).toHaveBeenCalledWith('/');
  });

  it('renders an existing item and its edit action', () => {
    vi.mocked(useLiveQuery).mockReturnValue({
      id: 7,
      series: ['Evangelion'],
      character: ['Asuka'],
      merchandise_type: 'figure',
      notes: 'Mint',
      photo: null,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    });
    render(
      <LanguageProvider>
        <ItemDetail />
      </LanguageProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Asuka' })).toBeInTheDocument();
    expect(screen.getByText('Evangelion')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Item' }));
    expect(routerMocks.navigate).toHaveBeenCalledWith('/edit/7');
  });

  it('shows what an unfinished item still lacks and opens the form to add it', () => {
    vi.mocked(useLiveQuery).mockReturnValue({
      id: 7,
      series: [],
      character: [],
      merchandise_type: '',
      notes: '',
      photos: [],
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    });
    render(
      <LanguageProvider>
        <ItemDetail />
      </LanguageProvider>,
    );

    expect(screen.getByText(/Still missing: a series or character and a type\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fill in details' }));
    expect(routerMocks.navigate).toHaveBeenCalledWith('/edit/7');
  });

  it('shows every photo of the item in a gallery', () => {
    vi.stubGlobal('URL', { ...globalThis.URL, createObjectURL: vi.fn(() => 'blob:detail'), revokeObjectURL: vi.fn() });
    vi.mocked(useLiveQuery).mockReturnValue({
      id: 7,
      series: ['Evangelion'],
      character: ['Asuka'],
      merchandise_type: 'figure',
      photos: [new Blob(['front'], { type: 'image/png' }), new Blob(['back'], { type: 'image/png' })],
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    });
    render(
      <LanguageProvider>
        <ItemDetail />
      </LanguageProvider>,
    );

    expect(screen.getByRole('group', { name: '2 photos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show photo 2' })).toBeInTheDocument();
    expect(screen.queryByText(/Still missing/)).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  describe('moving between items', () => {
    const asuka = {
      id: 7,
      series: ['Evangelion'],
      character: ['Asuka'],
      merchandise_type: 'figure',
      photos: [],
      created_at: new Date('2026-01-01T00:00:00.000Z'),
    };

    function renderItem() {
      return render(
        <LanguageProvider>
          <ItemDetail />
        </LanguageProvider>,
      );
    }

    it('shows its place in the list it was opened from and moves to either side', () => {
      routerMocks.location = { state: { order: [5, 7, 9] } };
      vi.mocked(useLiveQuery).mockReturnValue(asuka);
      renderItem();

      expect(screen.getByRole('group', { name: 'Browse items' })).toHaveTextContent('2 of 3');
      fireEvent.click(screen.getByRole('button', { name: 'Next item' }));
      expect(routerMocks.navigate).toHaveBeenLastCalledWith('/item/9', { replace: true, state: { order: [5, 7, 9], from: 'right' } });
      fireEvent.click(screen.getByRole('button', { name: 'Previous item' }));
      expect(routerMocks.navigate).toHaveBeenLastCalledWith('/item/5', { replace: true, state: { order: [5, 7, 9], from: 'left' } });
    });

    it('stops at the ends of the list', () => {
      routerMocks.location = { state: { order: [7, 9] } };
      vi.mocked(useLiveQuery).mockReturnValue(asuka);
      renderItem();

      expect(screen.getByRole('button', { name: 'Previous item' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Next item' })).toBeEnabled();
    });

    it('moves with a swipe and with the arrow keys', () => {
      routerMocks.location = { state: { order: [5, 7, 9] } };
      vi.mocked(useLiveQuery).mockReturnValue(asuka);
      const { container } = renderItem();
      const page = container.querySelector('.item-detail-page');

      fireEvent.touchStart(page, { touches: [{ clientX: 300, clientY: 300 }] });
      fireEvent.touchEnd(page, { changedTouches: [{ clientX: 150, clientY: 310 }] });
      expect(routerMocks.navigate).toHaveBeenLastCalledWith('/item/9', expect.objectContaining({ replace: true }));

      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(routerMocks.navigate).toHaveBeenLastCalledWith('/item/5', expect.objectContaining({ replace: true }));
    });

    it('follows the newest-first order when opened without a list', () => {
      // The item query depends on the id alone; the order query on the passed order and the table.
      vi.mocked(useLiveQuery).mockImplementation((_query, deps) => (deps.length === 2 ? [3, 7, 11] : asuka));
      renderItem();

      expect(screen.getByRole('group', { name: 'Browse items' })).toHaveTextContent('2 of 3');
    });

    it('hands the order to the edit page, so it survives an edit', () => {
      routerMocks.location = { state: { order: [5, 7, 9] } };
      vi.mocked(useLiveQuery).mockReturnValue(asuka);
      renderItem();

      fireEvent.click(screen.getByRole('button', { name: 'Edit Item' }));
      expect(routerMocks.navigate).toHaveBeenCalledWith('/edit/7', { state: { order: [5, 7, 9] } });
    });

    it('offers no controls when there is no list to move through', () => {
      vi.mocked(useLiveQuery).mockReturnValue(asuka);
      renderItem();

      expect(screen.queryByRole('group', { name: 'Browse items' })).not.toBeInTheDocument();
    });
  });
});
