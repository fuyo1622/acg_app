# 公開發佈準備度與執行清單

最後更新：2026-07-23

## 發佈目標

第一個公開版本暫定為：

- 公開的 Progressive Web App（PWA）。
- 使用 Vercel 託管正式 HTTPS 網址。
- 使用者從瀏覽器安裝到主畫面。
- 暫不包含 Apple App Store IPA 或 Google Play AAB 發佈。

若日後需要上架 App Store／Google Play，需另行建立原生包裝、簽署、商店素材、審核與更新流程。

## 稽核摘要

目前核心功能可以正常建置及測試，但原始狀態不適合直接公開。主要阻擋是第三方商品圖片、App 圖示權利、缺少正式授權、正式網域尚未決定，以及公開環境的部署、安全與隱私文件尚未完整。

已確認的品質基線：

- ESLint 通過。
- Vitest 共 6 個測試檔、28 個測試，全部通過。
- Vite production build 成功。
- PWA manifest 與 service worker 成功產生。
- 目前檔案及 Git 歷史的啟發式掃描未發現明顯 API key、密碼或 private key。
- `package-lock.json` 內的套件授權欄位未發現 GPL／AGPL 類型；這不取代正式法律審查。

## P0：公開前阻擋事項

### 發佈與部署

- [x] 第一版以公開 PWA／Vercel 為暫定目標。
- [ ] 決定並綁定長期使用的 production domain。
- [x] 確認同時公開原始碼 repository。
- [x] 將 GitHub repository visibility 由 Private 改成 Public。
- [x] 選擇 MIT 原始碼授權。
- [x] 以 GitHub 帳號 `fuyo1622` 作為著作權人名稱並加入 `LICENSE`。
- [x] 第一版暫不上架 App Store／Google Play。
- [x] 加入 Vercel SPA rewrite，避免直接開啟 `/item/...`、`/edit/...`、`/privacy` 時出現 404。
- [x] 加入 production security headers 與合理的快取規則。
- [x] 目前正式部署目標為 Vercel 根路徑，不設定 Vite 子路徑 `base`。

### 素材與權利

- [x] 移除 Kadokawa 商品圖片、測試資料與非核心爬蟲。
- [x] 重寫 `main` 並強制更新遠端，讓第三方圖片 blob 不再能從公開分支歷史到達。
- [x] 以原創幾何品牌圖示替換現有含浮水印的 PWA／Apple 圖示。
- [x] 產生真正的 192×192、512×512、maskable 512×512 與 Apple 180×180 PNG。
- [x] 確認所有圖示 MIME、實際尺寸與 manifest 宣告一致。
- [x] 移除未使用且來源不明的公開素材。
- [x] 建立第三方套件授權／NOTICE 清單。

### 隱私、資料與安全

- [x] 提供繁體中文與英文隱私說明。
- [x] 在 App 內提供可直接開啟的隱私頁面。
- [x] 明確說明收藏資料與照片只存在瀏覽器 IndexedDB。
- [x] 明確說明 JSON 備份未加密，可能包含照片、備註與收藏資訊。
- [x] 明確說明清除網站資料、瀏覽器回收空間或更換網域可能造成資料無法存取。
- [x] 移除 Google Fonts runtime 對外請求，改用系統字型。
- [x] 移除開放式 `allowedHosts: true` 開發設定。
- [x] 加入 `SECURITY.md` 與弱點回報方式。
- [x] 加入 dependency audit 指令與自動依賴更新設定。
- [x] 在 CI 執行高風險等級的依賴弱點稽核。
- [x] 對最新線上漏洞資料執行人工確認，更新相依套件後 `npm audit` 回報 0 個漏洞。

### 發行品質

- [x] 加入 CI：`npm ci`、lint、test、build。
- [x] 將專案版本與 Git 發行版本對齊。
- [x] 驗證正式 manifest、service worker、圖示尺寸及格式。
- [ ] 在 Android Chrome 與 iOS Safari 驗證安裝、離線重啟與資料持久性。
- [ ] 在正式網域驗證深層網址重新整理及 service worker 更新。

## P1：第一個公開版本建議事項

### 匯入、資料安全與容量

- [ ] 限制備份檔案大小、項目數、欄位長度與照片大小。
- [ ] 驗證 Data URL 實際 MIME、解碼結果與內容大小，不只檢查 `data:image/` 前綴。
- [ ] 避免對大型備份使用無上限的 `Promise.all`。
- [ ] 匯入取代資料前提供自動備份。
- [ ] 顯示瀏覽器儲存空間用量及容量不足提示。
- [ ] 評估並請求 persistent storage。
- [ ] 對大量收藏加入分頁或 Dexie 層級查詢。

### 無障礙與操作品質

- [ ] 移除 `user-scalable=no`。
- [ ] 語言切換時同步更新 `<html lang>`。
- [ ] 讓商品卡片、圖片選擇區及圖片更換區可用鍵盤操作。
- [ ] 補齊 focus-visible、reduced-motion、對比度與螢幕閱讀器測試。
- [ ] 將重要的 `alert`／`confirm` 流程改為可存取的 App 內對話框。

### 錯誤處理、測試與維護

- [ ] 修正不存在商品時永久顯示 Loading 的狀態。
- [ ] 加入 Item Detail、刪除、schema migration、備份取代失敗等測試。
- [ ] 加入 E2E：新增、編輯、刪除、匯出、匯入、離線及更新流程。
- [ ] 加入 error boundary 與使用者可理解的資料庫錯誤訊息。
- [ ] 統一 schema version 文件。
- [ ] 加入 `CHANGELOG.md`、支援方式與瀏覽器支援範圍。
- [ ] 若接受外部貢獻，加入 `CONTRIBUTING.md` 與行為準則。

## 仍需專案擁有者決定

以下項目不能由程式碼安全推定：

1. 正式 production domain。
2. 是否要將 MIT `LICENSE` 中的 `fuyo1622` 改成真實姓名或其他法律實體名稱。
3. Git 歷史重寫完成後，協作者需要重新 clone 或重設本機分支。

## 2026-07-23 P0 執行紀錄

- 移除目前工作樹中的第三方商品圖、爬蟲與未使用素材。
- 建立完整 Git bundle 備份後重寫 `main`；舊商品圖 blob 不再能從新 `main` 到達，並以 `--force-with-lease` 更新遠端。
- 以可重複產生的原創幾何圖示替換 PWA、maskable、Apple touch 與 favicon 素材。
- 加入 Vercel SPA rewrite、CSP、HSTS、Permissions Policy 及其他安全標頭。
- 移除 Google Fonts runtime 請求及開放式 Vite host 設定。
- 加入雙語 App 隱私頁、完整 `PRIVACY.md`、`SECURITY.md` 與第三方授權清單。
- 加入 GitHub Actions CI、Dependabot、audit、NOTICE 產生器與 release asset verifier。
- 專案版本由 `0.0.0` 對齊至 `0.1.4`。
- 線上 npm audit 初次發現 16 個項目（1 critical、11 high、3 moderate、1 low）；更新相容範圍內的修正版及重建第三方授權清單後，第二次 audit 回報 0 個漏洞。
- ESLint、28 個 Vitest 測試、production build、release asset verifier、YAML 解析及線上 dependency audit 均通過。
- 以 production preview 實際檢查繁體中文／英文首頁、隱私頁、語言屬性、直接重新整理及畫面水平溢位；瀏覽器 console 沒有 error 或 warning。
- GitHub repository visibility 已由 Private 改為 Public。
