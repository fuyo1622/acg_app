import { Plus, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { WISHLIST_LIMITS } from '../utils/constants';
import { createLinkRow } from '../utils/wishlistUtils';

// Addresses are typed or pasted as free text and normalized on save. A type="url" input
// would block "amiami.com/..." with a browser error, and a length limit would cut a
// pasted address short instead of reporting it.
export default function LinkListEditor({ rows, onChange }) {
  const { t } = useLanguage();

  const updateRow = (key, field, value) => {
    onChange(rows.map(row => (row.key === key ? { ...row, [field]: value } : row)));
  };

  return (
    <fieldset className="form-group link-editor">
      <legend>{t('links')}</legend>

      {rows.map((row, index) => (
        <div className="link-row" key={row.key}>
          <input
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-label={t('linkAddress', { index: index + 1 })}
            placeholder="https://"
            value={row.url}
            onChange={event => updateRow(row.key, 'url', event.target.value)}
          />
          <input
            type="text"
            aria-label={t('linkLabel', { index: index + 1 })}
            placeholder={t('linkLabelPlaceholder')}
            maxLength={WISHLIST_LIMITS.maxLinkLabelLength}
            value={row.label}
            onChange={event => updateRow(row.key, 'label', event.target.value)}
          />
          <button
            type="button"
            className="link-remove-btn"
            aria-label={t('removeLink', { index: index + 1 })}
            onClick={() => onChange(rows.filter(item => item.key !== row.key))}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      ))}

      {rows.length < WISHLIST_LIMITS.maxLinks && (
        <button
          type="button"
          className="btn btn-secondary link-add-btn"
          onClick={() => onChange([...rows, createLinkRow()])}
        >
          <Plus size={18} aria-hidden="true" />
          {t('addLink')}
        </button>
      )}
    </fieldset>
  );
}
