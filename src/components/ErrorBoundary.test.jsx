import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../contexts/LanguageContext';
import AppErrorBoundary from './ErrorBoundary';

function Exploding() {
  throw new Error('render failed');
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders children while nothing throws', () => {
    render(
      <LanguageProvider>
        <AppErrorBoundary><p>Collection</p></AppErrorBoundary>
      </LanguageProvider>
    );

    expect(screen.getByText('Collection')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('replaces a crashed subtree with a translated, reassuring alert', () => {
    render(
      <LanguageProvider>
        <AppErrorBoundary><Exploding /></AppErrorBoundary>
      </LanguageProvider>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('The app could not continue');
    expect(alert).toHaveTextContent('Your local data has not been intentionally changed.');
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeInTheDocument();
    expect(console.error).toHaveBeenCalled();
  });
});
