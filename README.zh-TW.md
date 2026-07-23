# ACG 收藏管理 App

[English](README.md) | [繁體中文](README.zh-TW.md)

這是一個 local-first 的漸進式網頁應用程式（PWA），用來記錄動漫、漫畫與遊戲相關收藏品。

正式版：[https://acg-app-steel.vercel.app/](https://acg-app-steel.vercel.app/)

## 功能

- 使用 IndexedDB 將收藏資料與照片保存在目前裝置的瀏覽器。
- 新增、查看、編輯、刪除、搜尋及篩選收藏品。
- 拍照或從相簿選圖，並在儲存前壓縮較大的圖片。
- 匯出單一 JSON 備份檔，之後可取代式還原。
- 從 Android Chrome 或 iOS Safari 安裝到主畫面。
- 成功連線載入一次後，可離線開啟已快取的 App。
- 支援繁體中文與英文介面。

## 安裝指南

### Android 手機／平板

1. 使用 Chrome 開啟[正式版 App](https://acg-app-steel.vercel.app/)。
2. 點右上角 Chrome 選單。
3. 選擇「安裝應用程式」或「加到主畫面」。
4. 從主畫面或應用程式列表開啟 **ACG**。

### iPhone／iPad

1. 使用 Safari 開啟[正式版 App](https://acg-app-steel.vercel.app/)。
2. 點 Safari 的「分享」按鈕。
3. 選擇「加入主畫面」，再按「加入」。
4. 從主畫面的 **ACG** 圖示開啟。

### 安裝與資料注意事項

- 第一次使用時請先保持連線，等首頁完整載入後再測試離線模式。
- 請勿使用無痕／私密瀏覽安裝或保存正式資料。
- 收藏資料只存在目前瀏覽器與 `acg-app-steel.vercel.app` 網域的 IndexedDB，Vercel 不會保存收藏內容。
- 清除網站資料、移除瀏覽器資料、更換裝置或改用另一個網域，都可能讓原資料無法存取。
- 進行上述操作前，請先在首頁按「匯出備份」保存 JSON 檔案。
- 匯入備份會在確認後取代目前收藏，不是合併。

## 本機開發

需求：Node.js 20.19–24 與 npm。

```bash
npm install
npm run dev
```

常用檢查：

```bash
npm run check
npm run test:e2e
npm run verify:release
npm run audit
```

`npm run check` 會依序執行 ESLint、Vitest 測試與 production build。
`npm run test:e2e` 會建置 App 並執行 Chromium 端對端測試；第一次執行前可先跑
`npx playwright install chromium` 安裝測試瀏覽器。

## 技術架構與限制

- React 19、Vite、React Router、Dexie 與 `vite-plugin-pwa`。
- IndexedDB 資料庫 `acg-merch-db` 目前為 schema version 2；唯一版本來源是
  `src/services/db.js` 的 `DB_SCHEMA_VERSION`。日後變更 schema 必須同步提高版本、
  加入 Dexie migration 並測試舊資料轉換。
- 沒有帳號、後端、雲端同步或收藏資料的伺服器副本。
- 備份採取代式還原；目前收藏不是空的時，覆蓋前會先自動下載安全備份。
- 瀏覽器可能依儲存空間政策移除網站資料，重要收藏請定期備份。
- 目前是可安裝的跨平台 PWA，不是 Android APK／AAB，也不是 iOS IPA／App Store 原生 App。

## 瀏覽器支援範圍

- 核心功能支援 Chrome、Edge、Firefox 與 Safari 的目前及前一個主要版本。
- 安裝與離線 PWA 流程會持續以 Chromium 做自動化測試；iPhone／iPad 安裝則依賴
  Safari 的「加入主畫面」功能。
- 容量估算及持久儲存權限由瀏覽器決定；未授權不影響一般使用，但仍需定期匯出。
- 無痕／私密瀏覽與 App 內嵌瀏覽器不適合長期保存資料，因此不列入支援範圍。

## 支援與問題回報

若有使用問題、程式錯誤或功能建議，請填寫中英文皆可使用的
[問題回報表單](https://tally.so/r/KYNy7M)，不需要 GitHub 帳號。熟悉 GitHub 的使用者
也可以建立 [GitHub issue](https://github.com/fuyo1622/acg_app/issues)。

請勿上傳 JSON 備份、私人收藏照片、密碼或其他敏感資料。安全漏洞請依
[安全政策](SECURITY.md)提供的方式回報，不要填入公開表單或公開 issue。

## 專案與政策資訊

請參考[支援方式](SUPPORT.md)、[版本紀錄](CHANGELOG.md)、[貢獻指南](CONTRIBUTING.md)、
[行為準則](CODE_OF_CONDUCT.md)、[隱私政策](PRIVACY.md)、[安全政策](SECURITY.md)、
[素材來源](ASSETS.md)及[第三方授權](THIRD_PARTY_NOTICES.md)。

## 授權

本專案採用 [MIT License](LICENSE)。
