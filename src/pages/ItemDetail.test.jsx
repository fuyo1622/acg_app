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
});
