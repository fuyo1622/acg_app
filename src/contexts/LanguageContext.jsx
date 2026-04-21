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
    noPhoto: 'No Photo',
    unknownCharacter: 'Unknown Character',
    unknownSeries: 'Unknown Series',
    addedOn: 'Added on',
    editItem: 'Edit Item',
    newItem: 'New Item',
    
    // Home
    myCollection: 'My Collection',
    searchPlaceholder: 'Search by series, character...',
    noItemsFound: 'No items found',
    tryAdjusting: 'Try adjusting your filters or add a new item.',
    
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
    validationRequireOne: 'Please enter at least a series or character.',
    validationRequireType: 'Please select a merchandise type.',
    saveError: 'Failed to save item. Storage might be full.',
    
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
    typeToSearch: 'Type to search or add...',
    addSelfDefinedType: 'Add self-defined type...',
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
    noPhoto: '無照片',
    unknownCharacter: '未知角色',
    unknownSeries: '未知系列',
    addedOn: '新增於',
    editItem: '編輯項目',
    newItem: '新增項目',
    
    // Home
    myCollection: '我的收藏',
    searchPlaceholder: '搜尋系列、角色...',
    noItemsFound: '找不到任何項目',
    tryAdjusting: '請嘗試調整過濾器或新增項目。',
    
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
    validationRequireOne: '請至少輸入作品系列或角色名稱。',
    validationRequireType: '請選擇一個周邊類型。',
    saveError: '儲存失敗，儲存空間可能已滿。',
    
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
    typeToSearch: '直接輸入來搜尋或新增...',
    addSelfDefinedType: '新增自訂類型...',
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
  }, [lang]);

  const t = (key) => translations[lang][key] || key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
