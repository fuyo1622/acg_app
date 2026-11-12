import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveQuery } from 'dexie-react-hooks';
import { LanguageProvider } from '../contexts/LanguageContext';
import { deleteTerm, renameTerm, saveTermOrder } from '../services/terms';
import ManageTerms from './ManageTerms';

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}));

vi.mock('../services/db', () => ({
  db: { items: {}, wishlist: {}, terms: {} },
}));

vi.mock('../services/terms', () => ({
  saveTermOrder: vi.fn(),
  renameTerm: vi.fn(),
  deleteTerm: vi.fn(),
}));

const items = [
  { id: 1, series: ['Gundam'], character: ['Char'], merchandise_type: 'figure' },
  { id: 2, series: ['EVA'], character: ['Asuka'], merchandise_type: 'figure' },
];
const wishlist = [{ id: 3, name: 'Zaku', series: ['Gundam', 'Zeta Gundam'], character: [], merchandise_type: 'Nendoroid' }];
const savedSeries = ['Macross', 'EVA', 'Gundam'];
// The saved order, then the series only an entry uses.
const seriesList = [...savedSeries, 'Zeta Gundam'];

function renderPage() {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <ManageTerms />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

const row = name => screen.getByRole('button', { name: new RegExp(`^${name} \\d+ items use it$`) });
const openSeries = () => fireEvent.click(screen.getByRole('button', { name: 'Series' }));

describe('ManageTerms', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    vi.mocked(useLiveQuery).mockImplementation((query) => {
      const source = query.toString();
      if (source.includes('db.items')) return items;
      if (source.includes('db.wishlist')) return wishlist;
      if (source.includes('db.terms')) return [{ field: 'series', values: savedSeries }];
      return undefined;
    });
    vi.mocked(saveTermOrder).mockResolvedValue(undefined);
    vi.mocked(renameTerm).mockResolvedValue(undefined);
    vi.mocked(deleteTerm).mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('lists the types first, in the current language, with how many items use each', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Types' })).toHaveAttribute('aria-pressed', 'true');
    expect(row('Figure/Statue')).toBeInTheDocument();
    expect(row('Nendoroid')).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: 'Figure/Statue 2 items use it' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drag Figure/Statue to change the order' })).toBeInTheDocument();
  });

  it('shows series in the saved order, then values that only items use', () => {
    renderPage();
    openSeries();

    const names = screen.getAllByRole('button', { name: /items use it$/ })
      .map(button => button.querySelector('.term-label').textContent);
    expect(names).toEqual(['Macross', 'EVA', 'Gundam', 'Zeta Gundam']);
    expect(row('Gundam')).toHaveTextContent('2');
  });

  it('adds a value to the end, and refuses an empty or repeated name', () => {
    renderPage();
    openSeries();
    const input = screen.getByRole('textbox', { name: 'New series' });

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name.');

    fireEvent.change(input, { target: { value: ' gundam ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The list already has gundam.');
    expect(saveTermOrder).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'Code Geass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(saveTermOrder).toHaveBeenCalledWith('series', [...seriesList, 'Code Geass']);
    expect(input).toHaveValue('');
  });

  it('renames a value, and asks before merging it into one the list already has', async () => {
    renderPage();
    openSeries();

    fireEvent.click(row('EVA'));
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New name for EVA' }), { target: { value: 'Evangelion' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(renameTerm).toHaveBeenCalledWith('series', seriesList, 'EVA', 'Evangelion');
    });

    fireEvent.click(row('EVA'));
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New name for EVA' }), { target: { value: 'gundam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const merge = screen.getByRole('alertdialog', { name: 'Merge into Gundam?' });
    expect(merge).toHaveTextContent('Every item that uses EVA gets Gundam instead');
    fireEvent.click(within(merge).getByRole('button', { name: 'Merge' }));
    await waitFor(() => {
      expect(renameTerm).toHaveBeenLastCalledWith('series', seriesList, 'EVA', 'Gundam');
    });
  });

  it('says how many items use a value before deleting it', async () => {
    renderPage();
    openSeries();

    fireEvent.click(row('Gundam'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Delete Gundam?' });
    expect(confirm).toHaveTextContent('1 collection items and 1 wishlist entries use Gundam');
    expect(confirm).toHaveTextContent('marked Needs details');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(deleteTerm).toHaveBeenCalledWith('series', seriesList, 'Gundam');
    });

    fireEvent.click(row('Macross'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alertdialog', { name: 'Delete Macross?' }))
      .toHaveTextContent('No item uses Macross, so only the list changes.');
  });

  it('sorts by name, and moves a value up or down without dragging', () => {
    renderPage();
    openSeries();

    fireEvent.click(screen.getByRole('button', { name: 'Sort by name' }));
    expect(saveTermOrder).toHaveBeenLastCalledWith('series', ['EVA', 'Gundam', 'Macross', 'Zeta Gundam']);

    fireEvent.click(row('Gundam'));
    fireEvent.click(screen.getByRole('button', { name: 'Move up' }));
    // The sorted order shows at once, and the move starts from it.
    expect(saveTermOrder).toHaveBeenLastCalledWith('series', ['Gundam', 'EVA', 'Macross', 'Zeta Gundam']);
  });

  it('cannot move the first value up or the last one down', () => {
    renderPage();
    openSeries();

    fireEvent.click(row('Macross'));
    expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled();
    fireEvent.click(row('Zeta Gundam'));
    expect(screen.getByRole('button', { name: 'Move down' })).toBeDisabled();
  });
});
