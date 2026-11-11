import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import './SiblingNav.css';

// The previous and next buttons of a detail page and its place in the list. Swiping does
// the same; the buttons make it findable and work without a touch screen.
export default function SiblingNav({ navigation }) {
  const { t } = useLanguage();
  const { position, total, hasPrevious, hasNext, goPrevious, goNext } = navigation;
  if (total < 2 || position < 1) return null;

  return (
    <div className="sibling-nav" role="group" aria-label={t('browseItems')}>
      <button
        type="button"
        className="sibling-nav-button"
        onClick={goPrevious}
        disabled={!hasPrevious}
        aria-label={t('previousItem')}
      >
        <ChevronLeft size={24} aria-hidden="true" />
      </button>
      <span className="sibling-nav-position">{t('positionOfTotal', { current: position, total })}</span>
      <button
        type="button"
        className="sibling-nav-button"
        onClick={goNext}
        disabled={!hasNext}
        aria-label={t('nextItem')}
      >
        <ChevronRight size={24} aria-hidden="true" />
      </button>
    </div>
  );
}
