import { ArrowLeft, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import './Guide.css';

const content = {
  'zh-TW': {
    title: '使用說明',
    back: '返回收藏',
    intro: '收藏資料會保存在目前裝置的瀏覽器。一般 App 更新不需要重新匯出或匯入 JSON。',
    sections: [
      {
        title: '新增與管理收藏',
        items: [
          '點右下角「新增項目」，至少填寫作品系列或角色名稱，並選擇周邊類型。',
          '照片與備註皆為選填；首頁可搜尋及依類型、系列或角色篩選。',
          '點收藏卡片可查看內容，再使用編輯按鈕修改或刪除。',
        ],
      },
      {
        title: '瀏覽器儲存與 App 更新',
        items: [
          '收藏與照片存放在目前網域的 IndexedDB，綁定目前裝置、瀏覽器及使用者設定檔。',
          '使用相同網域與瀏覽器時，一般程式、快取或 Service Worker 更新會保留收藏，不需要重新匯入 JSON。',
          '「保護本機資料」可降低瀏覽器自動清除資料的機率，但無法防止手動清除、裝置損壞或遺失。',
        ],
      },
      {
        title: 'JSON 備份與還原',
        items: [
          'JSON 是復原用安全備份，不是每次更新 App 都必須執行的步驟。',
          '請定期匯出，並在清除網站資料、更換裝置／瀏覽器／網域或重大更新前另外保存。',
          '備份可能包含收藏、備註及照片，請存放在瀏覽器以外的私人安全位置。',
          '匯入會取代目前收藏；目前收藏不是空的時，App 會先自動下載安全備份。',
        ],
      },
      {
        title: '安裝、離線與回報',
        items: [
          'Android Chrome 可選「安裝應用程式」；iPhone／iPad Safari 可選「加入主畫面」。',
          '首次使用或更新後請先連線開啟一次，之後可離線開啟已快取的 App。',
          '遇到問題可使用首頁的「問題回報」，請勿上傳 JSON 備份或敏感資料。',
        ],
      },
    ],
  },
  en: {
    title: 'User guide',
    back: 'Back to collection',
    intro: 'Collection data stays in this device and browser. Normal app updates do not require exporting or importing JSON again.',
    sections: [
      {
        title: 'Add and manage items',
        items: [
          'Select Add Item in the lower-right corner, enter at least a series or character, and choose a merchandise type.',
          'Photos and notes are optional. Use the home page to search or filter by type, series, or character.',
          'Open a collection card to view it, then use Edit Item to make changes or delete it.',
        ],
      },
      {
        title: 'Browser storage and app updates',
        items: [
          'Collections and photos are stored in IndexedDB for the current domain, device, browser, and browser profile.',
          'On the same domain and browser, normal code, cache, or service-worker updates keep collection data and do not require a JSON import.',
          'Protect local data can reduce automatic browser eviction, but it cannot prevent manual deletion, device damage, or loss.',
        ],
      },
      {
        title: 'JSON backup and restore',
        items: [
          'JSON is a recovery backup, not a required step for every app update.',
          'Export periodically and before clearing site data, changing device, browser, or domain, or installing a major update.',
          'A backup may contain collection data, notes, and photos. Store it privately outside the browser.',
          'Import replaces the current collection. If it is not empty, the app downloads a safety backup first.',
        ],
      },
      {
        title: 'Install, offline use, and feedback',
        items: [
          'Use Install app in Android Chrome or Add to Home Screen in Safari on iPhone or iPad.',
          'Open the app online once after first use or an update; the cached app can then start offline.',
          'Use Send feedback on the home page for problems. Do not upload JSON backups or sensitive data.',
        ],
      },
    ],
  },
};

export default function Guide() {
  const { lang } = useLanguage();
  const copy = content[lang] || content.en;

  return (
    <div className="guide-page">
      <header className="page-header">
        <Link className="back-btn guide-back" to="/" aria-label={copy.back}>
          <ArrowLeft size={24} aria-hidden="true" />
        </Link>
        <BookOpen size={28} color="var(--accent-primary)" aria-hidden="true" />
      </header>

      <main className="guide-content glass-panel">
        <h1>{copy.title}</h1>
        <p className="guide-intro">{copy.intro}</p>

        {copy.sections.map(section => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            <ul>
              {section.items.map(item => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ))}

        <Link className="btn btn-secondary guide-home-link" to="/">
          {copy.back}
        </Link>
      </main>
    </div>
  );
}
