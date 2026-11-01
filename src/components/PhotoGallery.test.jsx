import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../contexts/LanguageContext';
import PhotoGallery from './PhotoGallery';

const photos = ['front', 'back', 'box'].map(name => new Blob([name], { type: 'image/png' }));

function renderGallery(props) {
  return render(
    <LanguageProvider>
      <PhotoGallery alt="Asuka figure" {...props} />
    </LanguageProvider>,
  );
}

describe('PhotoGallery', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    const urls = new Map(photos.map((blob, index) => [blob, `blob:photo-${index + 1}`]));
    const TestUrl = class extends globalThis.URL {};
    TestUrl.createObjectURL = vi.fn(blob => urls.get(blob) ?? 'blob:other');
    TestUrl.revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', TestUrl);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('shows a single photo without thumbnails', () => {
    renderGallery({ photos: [photos[0]] });

    expect(screen.getByRole('img', { name: 'Asuka figure' })).toHaveAttribute('src', 'blob:photo-1');
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('switches the large photo from its thumbnails', () => {
    renderGallery({ photos });

    expect(screen.getByRole('group', { name: '3 photos' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Asuka figure' })).toHaveAttribute('src', 'blob:photo-1');
    expect(screen.getByRole('button', { name: 'Show photo 1' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Show photo 3' }));

    expect(screen.getByRole('img', { name: 'Asuka figure' })).toHaveAttribute('src', 'blob:photo-3');
    expect(screen.getByRole('button', { name: 'Show photo 3' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Show photo 1' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('says there is no photo when the list is empty', () => {
    renderGallery({ photos: [] });

    expect(screen.getByRole('heading', { name: 'No Photo' })).toBeInTheDocument();
  });

  it('can expand a tall photo to its full height', () => {
    const { container } = renderGallery({ photos: [photos[0]], expandable: true });
    const toggle = screen.getByRole('button', { name: 'Show the whole image' });

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.detail-image-container')).toHaveClass('is-expanded');
  });
});
