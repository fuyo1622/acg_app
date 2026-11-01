import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../contexts/LanguageContext';
import PhotoListEditor from './PhotoListEditor';

function photo(name) {
  return new File([name], `${name}.png`, { type: 'image/png' });
}

// Holds the photos in state like the forms do, and exposes the latest list.
function renderEditor(initialPhotos = []) {
  const latest = { photos: initialPhotos };
  function Harness() {
    const [photos, setPhotos] = useState(initialPhotos);
    latest.photos = photos;
    return <PhotoListEditor photos={photos} onChange={setPhotos} />;
  }
  render(
    <LanguageProvider>
      <Harness />
    </LanguageProvider>,
  );
  return latest;
}

describe('PhotoListEditor', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    let counter = 0;
    const TestUrl = class extends globalThis.URL {};
    TestUrl.createObjectURL = vi.fn(() => `blob:photo-${(counter += 1)}`);
    TestUrl.revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', TestUrl);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('offers a keyboard-operable button to add the first photos', () => {
    renderEditor();

    const addButton = screen.getByRole('button', { name: /Add Photo/ });
    expect(addButton.tagName).toBe('BUTTON');
    expect(screen.getByLabelText('Add Photo')).toHaveAttribute('multiple');
  });

  it('adds several photos at once, skipping files that are not images', () => {
    const latest = renderEditor();
    const files = [photo('front'), new File(['x'], 'notes.txt', { type: 'text/plain' }), photo('back')];

    fireEvent.change(screen.getByLabelText('Add Photo'), { target: { files } });

    expect(latest.photos).toEqual([files[0], files[2]]);
    expect(screen.getByText('Cover')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Photo 1 of 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add photos' })).toBeInTheDocument();
  });

  it('makes another photo the cover and removes photos', () => {
    const [front, back, box] = [photo('front'), photo('back'), photo('box')];
    const latest = renderEditor([front, back, box]);

    fireEvent.click(screen.getByRole('button', { name: 'Make photo 3 the cover' }));
    expect(latest.photos).toEqual([box, front, back]);

    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 2' }));
    expect(latest.photos).toEqual([box, back]);
    expect(screen.queryByRole('button', { name: 'Make photo 1 the cover' })).not.toBeInTheDocument();
  });

  it('keeps an item to 10 photos and says so', () => {
    const latest = renderEditor(Array.from({ length: 8 }, (_, index) => photo(`p${index}`)));

    fireEvent.change(screen.getByLabelText('Add Photo'), {
      target: { files: [photo('a'), photo('b'), photo('c')] },
    });

    expect(latest.photos).toHaveLength(10);
    expect(screen.getByRole('status')).toHaveTextContent('An item can hold up to 10 photos.');
    expect(screen.queryByRole('button', { name: 'Add photos' })).not.toBeInTheDocument();
  });
});
