import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import './Privacy.css';

const content = {
  'zh-TW': {
    title: '隱私與本機資料',
    effectiveDate: '生效日期：2026-07-23',
    back: '返回收藏',
    summary: 'ACG Collector 是 local-first 的 PWA。收藏內容保存在目前裝置與瀏覽器，不會由 App 程式上傳至專案擁有者的伺服器。',
    sections: [
      {
        title: '儲存的資料',
        body: '作品與角色名稱、商品類型、備註及照片會儲存在目前網站網域的 IndexedDB。App 不包含帳號、雲端同步或分析追蹤程式。託管供應商仍可能處理 IP 位址、瀏覽器資訊及請求時間等標準網站紀錄。'
      },
      {
        title: '照片與備份',
        body: '支援的瀏覽器會在裝置端嘗試壓縮照片。匯出的 JSON 備份未加密，可能包含收藏資訊、備註及照片；請將備份視為私人資料妥善保管。匯入會在確認後取代目前收藏。'
      },
      {
        title: '資料遺失風險',
        body: '清除網站資料、瀏覽器或作業系統回收空間、更換裝置、瀏覽器或網站網域，都可能使原本資料無法存取。請定期匯出備份；沒有備份時，專案擁有者無法復原本機資料。'
      },
      {
        title: '刪除資料',
        body: '你可以在 App 中刪除個別項目，或透過瀏覽器的網站資料設定刪除全部資料。完整政策與安全回報方式請參閱 repository 的 PRIVACY.md 與 SECURITY.md。'
      }
    ]
  },
  en: {
    title: 'Privacy and local data',
    effectiveDate: 'Effective date: 2026-07-23',
    back: 'Back to collection',
    summary: 'ACG Collector is a local-first PWA. Collection content stays in the current device and browser and is not uploaded by the application code to a server operated by the project owner.',
    sections: [
      {
        title: 'Data stored',
        body: 'Series and character names, merchandise types, notes, and photos are stored in IndexedDB for the current website origin. The app has no accounts, cloud sync, or analytics tracking. The hosting provider may still process standard website logs such as IP address, browser information, and request time.'
      },
      {
        title: 'Photos and backups',
        body: 'Supported browsers attempt to compress photos on the device. Exported JSON backups are not encrypted and may include collection data, notes, and photos; store them as private data. Import replaces the current collection after confirmation.'
      },
      {
        title: 'Risk of data loss',
        body: 'Clearing site data, browser or operating-system storage eviction, or changing device, browser, or website domain can make existing data inaccessible. Export backups regularly. The project owner cannot recover local data without a backup.'
      },
      {
        title: 'Deleting data',
        body: 'Delete individual entries in the app or remove all data through the browser site-data settings. See PRIVACY.md and SECURITY.md in the repository for the complete policy and security reporting process.'
      }
    ]
  }
};

export default function Privacy() {
  const { lang } = useLanguage();
  const copy = content[lang] || content.en;

  return (
    <div className="privacy-page">
      <header className="page-header">
        <Link className="back-btn privacy-back" to="/" aria-label={copy.back}>
          <ArrowLeft size={24} />
        </Link>
        <ShieldCheck size={28} color="var(--accent-primary)" aria-hidden="true" />
      </header>

      <main className="privacy-content glass-panel">
        <h1>{copy.title}</h1>
        <p className="privacy-date">{copy.effectiveDate}</p>
        <p className="privacy-summary">{copy.summary}</p>

        {copy.sections.map(section => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}

        <Link className="btn btn-secondary privacy-home-link" to="/">
          {copy.back}
        </Link>
      </main>
    </div>
  );
}
