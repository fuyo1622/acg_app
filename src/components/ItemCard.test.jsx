import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../contexts/LanguageContext';
import ItemCard from './ItemCard';

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

  it('renders a photo through an object URL with descriptive alt text', () => {
    renderCard({
      id: 4,
      series: ['Gundam'],
      character: ['Char'],
      merchandise_type: 'plush',
      photo: new Blob(['photo'], { type: 'image/webp' }),
    });

    const image = screen.getByRole('img', { name: 'Char' });
    expect(image).toHaveAttribute('src', 'blob:card');
    expect(image).toHaveAttribute('loading', 'lazy');
  });
});
