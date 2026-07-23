/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useContext, useEffect } from 'react';

export const translations = {
  en: {
    // General
    cancel: 'Cancel',
    saveChanges: 'Save Changes',
    addItem: 'Add Item',
    loading: 'Loading item...',
    saving: 'Saving...',
    loadingCollection: 'Loading collection...',
    exportBackup: 'Export Backup',
    importBackup: 'Import Backup',
    importWarning: 'Warning: Importing a backup will completely REPLACE your current collection. Unsaved progress will be lost. Are you sure you want to proceed?',
    importSuccess: 'Backup imported successfully!',
    importError: 'Invalid backup file or corrupted payload version.',
    exportError: 'Export failed. Database might be empty or corrupted.',
    backupTitle: 'Backup',
    errorTitle: 'Something went wrong',
    successTitle: 'Completed',
    continue: 'Continue',
    close: 'Close',
    importSafetyBackup: 'A safety backup of your current collection will be downloaded before replacement.',
    noPhoto: 'No Photo',
    unknownCharacter: 'Unknown Character',
    unknownSeries: 'Unknown Series',
    addedOn: 'Added on',
    editItem: 'Edit Item',
    newItem: 'New Item',
    usageGuide: 'User guide',
    versionLabel: 'Version {version}',
    privacyPolicy: 'Privacy',
    sendFeedback: 'Send feedback',
    thirdPartyNotices: 'Third-party notices',
    
    // Home
    myCollection: 'My Collection',
    searchPlaceholder: 'Search by series, character...',
    noItemsFound: 'No items found',
    tryAdjusting: 'Try adjusting your filters or add a new item.',
    language: 'Language',
    importFile: 'Import backup file',
    searchLabel: 'Search collection',
    filterTypeLabel: 'Filter by merchandise type',
    filterSeriesLabel: 'Filter by series',
    filterCharacterLabel: 'Filter by character',
    showingItems: 'Showing {start}–{end} of {total}',
    previousPage: 'Previous',
    nextPage: 'Next',
    pageOf: 'Page {page} of {pages}',
    storageLabel: 'Browser storage',
    storageUsage: '{used} of {quota} used',
    storagePersistent: 'Protected from automatic eviction',
    storageBestEffort: 'May be removed when device storage is low',
    protectStorage: 'Protect local data',
    storageWarning: 'Browser storage is nearly full. Export a backup and remove large photos or old items.',
    persistenceGranted: 'Persistent storage has been enabled.',
    persistenceDenied: 'This browser did not grant persistent storage. Keep regular backups.',
    
    // Form & Detailed
    seriesFranchise: 'Series / Franchise',
    seriesPlaceholder: 'e.g. Neon Genesis Evangelion',
    character: 'Character',
    characterPlaceholder: 'e.g. Asuka Langley Soryu',
    merchandiseType: 'Merchandise Type',
    notesOptional: 'Notes (Optional)',
    notesPlaceholder: 'Condition, price, origin, etc.',
    notes: 'Notes',
    deleteConfirm: 'Are you sure you want to delete this item?',
    deleteTitle: 'Delete item?',
    deleteError: 'Failed to delete this item. Please try again.',
    validationRequireOne: 'Please enter at least a series or character.',
    validationRequireType: 'Please select a merchandise type.',
    saveError: 'Failed to save item. Storage might be full.',
    itemNotFound: 'This item does not exist or has already been deleted.',
    backHome: 'Back to collection',
    unexpectedErrorTitle: 'The app could not continue',
    unexpectedErrorMessage: 'Your local data has not been intentionally changed. Reload the app, then export a backup if the problem continues.',
    reloadApp: 'Reload app',
    
    // Types
    allTypes: 'All Types',
    figure: 'Figure/Statue',
    plush: 'Plush',
    acrylic: 'Acrylic Stand',
    badge: 'Badge/Pin',
    apparel: 'Apparel',
    poster: 'Poster/Print',
    other: 'Other',
    
    // Uploader
    addPhoto: 'Add Photo',
    tapToTake: 'Tap to take photo or choose from gallery',
    tapToChange: 'Tap to change',
    photoPreview: 'Selected item preview',
    removePhoto: 'Remove photo',
    typeToSearch: 'Type to search or add...',
    addSelfDefinedType: 'Add self-defined type...',
    addMultiValue: 'Add "{value}"',
    removeMultiValue: 'Remove {value}',
    allSeries: 'All Series',
    allCharacters: 'All Characters',
  },
  'zh-TW': {
    // General
    cancel: '取消',
    saveChanges: '儲存變更',
    addItem: '新增項目',
    loading: '載入中...',
    saving: '儲存中...',
    loadingCollection: '載入收藏中...',
    exportBackup: '匯出備份',
    importBackup: '匯入備份',
    importWarning: '警告：匯入備份將會完全覆蓋（取代）您目前的收藏。確定要繼續嗎？',
    importSuccess: '已經成功匯入備份！',
    importError: '無效的備份檔案或版本損毀。',
    exportError: '匯出失敗，資料庫可能異常或無資料。',
    backupTitle: '備份',
    errorTitle: '發生錯誤',
    successTitle: '已完成',
    continue: '繼續',
    close: '關閉',
    importSafetyBackup: '取代資料前，App 會先自動下載目前收藏的安全備份。',
    noPhoto: '無照片',
    unknownCharacter: '未知角色',
    unknownSeries: '未知系列',
    addedOn: '新增於',
    editItem: '編輯項目',
    newItem: '新增項目',
    usageGuide: '使用說明',
    versionLabel: '版本 {version}',
    privacyPolicy: '隱私',
    sendFeedback: '問題回報',
    thirdPartyNotices: '第三方授權',
    
    // Home
    myCollection: '我的收藏',
    searchPlaceholder: '搜尋系列、角色...',
    noItemsFound: '找不到任何項目',
    tryAdjusting: '請嘗試調整過濾器或新增項目。',
    language: '語言',
    importFile: '匯入備份檔案',
    searchLabel: '搜尋收藏',
    filterTypeLabel: '依周邊類型篩選',
    filterSeriesLabel: '依作品系列篩選',
    filterCharacterLabel: '依角色篩選',
    showingItems: '顯示第 {start}–{end} 項，共 {total} 項',
    previousPage: '上一頁',
    nextPage: '下一頁',
    pageOf: '第 {page} 頁，共 {pages} 頁',
    storageLabel: '瀏覽器儲存空間',
    storageUsage: '已使用 {used}／{quota}',
    storagePersistent: '已保護，不會因空間壓力被自動清除',
    storageBestEffort: '裝置空間不足時可能被瀏覽器清除',
    protectStorage: '保護本機資料',
    storageWarning: '瀏覽器儲存空間快滿了。請匯出備份，並移除大型照片或舊項目。',
    persistenceGranted: '已啟用持久儲存空間。',
    persistenceDenied: '瀏覽器未授予持久儲存空間，請定期備份。',
    
    // Form & Detailed
    seriesFranchise: '作品系列',
    seriesPlaceholder: '例如：新世紀福音戰士',
    character: '角色名稱',
    characterPlaceholder: '例如：明日香',
    merchandiseType: '周邊類型',
    notesOptional: '備註 (選填)',
    notesPlaceholder: '商品狀況、價格、來源等',
    notes: '備註',
    deleteConfirm: '確定要刪除這個項目嗎？',
    deleteTitle: '刪除項目？',
    deleteError: '刪除失敗，請稍後再試。',
    validationRequireOne: '請至少輸入作品系列或角色名稱。',
    validationRequireType: '請選擇一個周邊類型。',
    saveError: '儲存失敗，儲存空間可能已滿。',
    itemNotFound: '這個項目不存在或已經被刪除。',
    backHome: '返回收藏',
    unexpectedErrorTitle: 'App 無法繼續執行',
    unexpectedErrorMessage: 'App 並未刻意變更您的本機資料。請重新載入；若問題持續，請儘快匯出備份。',
    reloadApp: '重新載入 App',
    
    // Types
    allTypes: '所有類型',
    figure: '模型/公仔',
    plush: '絨毛玩偶',
    acrylic: '壓克力立牌',
    badge: '徽章/別針',
    apparel: '服飾',
    poster: '海報/畫作',
    other: '其他',
    
    // Uploader
    addPhoto: '加入照片',
    tapToTake: '點擊拍照或從相簿選擇',
    tapToChange: '點擊更換',
    photoPreview: '已選商品照片預覽',
    removePhoto: '移除照片',
    typeToSearch: '直接輸入來搜尋或新增...',
    addSelfDefinedType: '新增自訂類型...',
    addMultiValue: '新增「{value}」',
    removeMultiValue: '移除 {value}',
    allSeries: '所有系列',
    allCharacters: '所有角色',
  }
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('appLang') || 'zh-TW';
  });

  useEffect(() => {
    localStorage.setItem('appLang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key, values = {}) => {
    const template = translations[lang]?.[key] || translations.en[key] || key;
    return Object.entries(values).reduce(
      (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
      template,
    );
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
