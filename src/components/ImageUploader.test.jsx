import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../contexts/LanguageContext';
import ImageUploader from './ImageUploader';

describe('ImageUploader accessibility', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    vi.stubGlobal('URL', {
      ...globalThis.URL,
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('uses keyboard-operable buttons for selecting, changing and removing a photo', () => {
    const onImageSelected = vi.fn();
    const { rerender } = render(
      <LanguageProvider>
        <ImageUploader onImageSelected={onImageSelected} />
      </LanguageProvider>,
    );

    const addButton = screen.getByRole('button', { name: /Add Photo/i });
    expect(addButton).toBeEnabled();
    fireEvent.click(addButton);

    rerender(
      <LanguageProvider>
        <ImageUploader defaultImage={new Blob(['photo'], { type: 'image/png' })} onImageSelected={onImageSelected} />
      </LanguageProvider>,
    );

    expect(screen.getByRole('button', { name: 'Tap to change' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    expect(onImageSelected).toHaveBeenCalledWith(null);
  });
});
