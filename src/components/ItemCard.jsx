import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { formatValues } from '../utils/valueUtils';

export default function ItemCard({ item }) {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const imageUrl = useObjectUrl(item.photo);
  const separator = lang === 'en' ? ', ' : '、';
  const characterText = formatValues(item.character, separator);
  const seriesText = formatValues(item.series, separator);

  return (
    <div 
      className="item-card glass-panel"
      onClick={() => navigate(`/item/${item.id}`)}
    >
      <div className="image-container">
        {item.photo ? (
          <img src={imageUrl} alt={characterText || seriesText} loading="lazy" />
        ) : (
          <div className="no-image">{t('noPhoto')}</div>
        )}
        <div className="item-badge">{t(item.merchandise_type)}</div>
      </div>
      <div className="item-info">
        <h3>{characterText || t('unknownCharacter')}</h3>
        <p className="series">{seriesText || t('unknownSeries')}</p>
      </div>
    </div>
  );
}
