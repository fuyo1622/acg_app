import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useObjectUrl } from '../hooks/useObjectUrl';

export default function ItemCard({ item }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const imageUrl = useObjectUrl(item.photo);

  return (
    <div 
      className="item-card glass-panel"
      onClick={() => navigate(`/item/${item.id}`)}
    >
      <div className="image-container">
        {item.photo ? (
          <img src={imageUrl} alt={item.character || item.series} loading="lazy" />
        ) : (
          <div className="no-image">{t('noPhoto')}</div>
        )}
        <div className="item-badge">{t(item.merchandise_type)}</div>
      </div>
      <div className="item-info">
        <h3>{item.character || t('unknownCharacter')}</h3>
        <p className="series">{item.series || t('unknownSeries')}</p>
      </div>
    </div>
  );
}
