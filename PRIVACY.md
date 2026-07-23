# ACG Collector Privacy Notice

Effective date: 2026-07-23

## 繁體中文

### 資料儲存

ACG Collector 是 local-first 的 Progressive Web App。收藏項目、作品與角色名稱、商品類型、備註及照片會儲存在使用者目前瀏覽器的 IndexedDB。App 程式不會將這些收藏內容傳送至專案擁有者的伺服器，也不包含帳號、雲端同步或分析追蹤程式。

網站託管服務仍可能依其一般運作方式處理標準 HTTP 請求資訊，例如 IP 位址、瀏覽器資訊、請求時間與所存取的檔案。這些託管服務紀錄不包含儲存在 IndexedDB 中的收藏內容。

### 照片與備份

照片在支援的瀏覽器中會先於裝置端嘗試壓縮，再儲存在 IndexedDB。匯出的 JSON 備份未加密，可能包含收藏名稱、備註及以 Data URL 編碼的照片。請將備份視為私人資料並妥善保管。

匯入備份會在確認後取代目前的收藏。除非使用者自行匯出備份，專案擁有者無法復原遺失的本機資料。

### 資料保留與刪除

資料會保留在目前瀏覽器及網站網域的儲存空間，直到使用者在 App 中刪除項目、清除網站資料，或瀏覽器／作業系統回收該儲存空間。更換瀏覽器、裝置、通訊協定或網站網域會使用不同的儲存空間。

使用者可以透過瀏覽器的網站資料設定刪除所有 App 資料。刪除後若沒有先前匯出的備份，資料可能無法復原。

### 外部服務

App runtime 不會載入 Google Fonts 或其他第三方字型服務。正式網站由託管供應商提供 HTTPS 與靜態檔案傳輸；供應商的資料處理依其隱私政策辦理。

### 聯絡方式

若 repository 已公開，請使用 repository 的 GitHub Issues 提出一般隱私問題。安全弱點請依 `SECURITY.md` 的非公開回報方式處理。

## English

### Data storage

ACG Collector is a local-first Progressive Web App. Collection entries, series and character names, merchandise types, notes, and photos are stored in IndexedDB in the user's current browser. The application code does not send this collection content to a server operated by the project owner and does not include accounts, cloud synchronization, or analytics tracking.

The hosting provider may process standard HTTP request information, such as IP addresses, browser information, request times, and requested static files, as part of normal hosting operations. Hosting logs do not include collection content stored in IndexedDB.

### Photos and backups

Supported browsers attempt to compress selected photos on the device before storing them in IndexedDB. Exported JSON backups are not encrypted and may contain collection names, notes, and photos encoded as Data URLs. Treat backup files as private data and store them securely.

Importing a backup replaces the current collection after confirmation. The project owner cannot recover lost local data unless the user previously exported a backup.

### Retention and deletion

Data remains in storage associated with the current browser and website origin until the user deletes entries, clears site data, or the browser or operating system evicts the storage. A different browser, device, protocol, or domain uses a different storage area.

Users can delete all application data through their browser's site-data settings. Data may be unrecoverable after deletion if no backup was exported.

### External services

The application runtime does not load Google Fonts or another third-party font service. The production hosting provider supplies HTTPS and static file delivery and processes data under its own privacy policy.

### Contact

When the repository is public, use its GitHub Issues for general privacy questions. Report security vulnerabilities privately as described in `SECURITY.md`.
