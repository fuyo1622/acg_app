import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { LanguageProvider } from '../contexts/LanguageContext';
import Guide from './Guide';

function renderGuide(language) {
  localStorage.setItem('appLang', language);
  return render(
    <LanguageProvider>
      <MemoryRouter>
        <Guide />
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('Guide', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('explains updates and JSON backups in Traditional Chinese', () => {
    renderGuide('zh-TW');

    expect(screen.getByRole('heading', { name: '使用說明' })).toBeInTheDocument();
    expect(screen.getByText(/一般 App 更新不需要重新匯出或匯入 JSON/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'JSON 備份與還原' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '願望清單' })).toBeInTheDocument();
    expect(screen.getByText(/0\.4\.0 之前建立的備份只含收藏/)).toBeInTheDocument();
  });

  it('shows the English guide when the interface language is English', () => {
    renderGuide('en');

    expect(screen.getByRole('heading', { name: 'User guide' })).toBeInTheDocument();
    expect(screen.getByText(/Normal app updates do not require exporting or importing JSON again/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Browser storage and app updates' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Wishlist' })).toBeInTheDocument();
    expect(screen.getByText(/made before version 0\.4\.0 holds only the collection/)).toBeInTheDocument();
  });
});
