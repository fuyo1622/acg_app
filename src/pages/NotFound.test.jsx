import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LanguageProvider } from '../contexts/LanguageContext';
import NotFound from './NotFound';

function renderNotFound() {
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    </LanguageProvider>
  );
}

describe('NotFound', () => {
  afterEach(cleanup);

  beforeEach(() => {
    localStorage.setItem('appLang', 'en');
  });

  it('explains the unknown address and offers a way back to the collection', () => {
    renderNotFound();

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText(/still safe on this device/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to collection' })).toHaveAttribute('href', '/');
  });

  it('localizes the message in Traditional Chinese', () => {
    localStorage.setItem('appLang', 'zh-TW');
    renderNotFound();

    expect(screen.getByRole('heading', { name: '找不到頁面' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回收藏' })).toBeInTheDocument();
  });
});
