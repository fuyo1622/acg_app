import { useLanguage } from '../contexts/LanguageContext';

export default function Pagination({ page, pageCount, start, end, total, onPageChange }) {
  const { t } = useLanguage();
  const pageLabel = t('pageOf', { page, pages: pageCount });

  return (
    <nav className="pagination" aria-label={pageLabel}>
      <p>{t('showingItems', { start, end, total })}</p>
      <div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          {t('previousPage')}
        </button>
        <span>{pageLabel}</span>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={page >= pageCount}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        >
          {t('nextPage')}
        </button>
      </div>
    </nav>
  );
}
