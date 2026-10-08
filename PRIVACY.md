# ACG Collector Privacy Notice

Effective date: 2026-10-08

## 繁體中文

### 資料儲存

ACG Collector 是 local-first 的 Progressive Web App。收藏與願望清單的內容會儲存在使用者目前瀏覽器的 IndexedDB，包括作品與角色名稱、商品類型、備註、照片，以及願望清單的商品名稱、商店、連結、價格與幣別、下單截止日、發售時間、優先度與狀態。介面語言與上次使用的幣別會儲存在瀏覽器的 localStorage。App 程式不會將這些內容傳送至專案擁有者的伺服器，也不包含帳號、雲端同步或分析追蹤程式。

網站託管服務仍可能依其一般運作方式處理標準 HTTP 請求資訊，例如 IP 位址、瀏覽器資訊、請求時間與所存取的檔案。這些託管服務紀錄不包含儲存在 IndexedDB 中的收藏與願望清單內容。

### 照片與備份

照片在支援的瀏覽器中會先於裝置端嘗試壓縮，再儲存在 IndexedDB。匯出的 JSON 備份未加密，可能包含收藏與願望清單的名稱、備註、連結、價格及以 Data URL 編碼的照片。請將備份視為私人資料並妥善保管。

匯入備份會在確認後取代目前的收藏與願望清單；0.4.0 之前建立的備份只含收藏，匯入時會保留目前的願望清單。除非使用者自行匯出備份，專案擁有者無法復原遺失的本機資料。

### 資料保留與刪除

資料會保留在目前瀏覽器及網站網域的儲存空間，直到使用者在 App 中刪除項目、清除網站資料，或瀏覽器／作業系統回收該儲存空間。更換瀏覽器、裝置、通訊協定或網站網域會使用不同的儲存空間。

使用者可以透過瀏覽器的網站資料設定刪除所有 App 資料。刪除後若沒有先前匯出的備份，資料可能無法復原。

### 外部服務

App runtime 不會載入 Google Fonts 或其他第三方字型服務。正式網站由託管供應商提供 HTTPS 與靜態檔案傳輸；供應商的資料處理依其隱私政策辦理。

### 願望清單連結

願望清單中儲存的連結（例如商店頁面）只有在使用者點選時，才會在新分頁開啟該外部網站。App 只儲存 http／https 網址，開啟連結時不會傳送 App 的網址作為來源（referrer），也不會自行連線到這些網站或讀取其內容。開啟後，該網站會依其一般運作方式處理 IP 位址、瀏覽器資訊等請求資訊，並依其自身的隱私政策處理資料。

### 問題回報表單

首頁的「問題回報」連結會離開 App 並開啟由 Tally 提供的外部表單。只有使用者主動送出表單時，Tally 才會接收回報內容、選填的聯絡 Email、選填的圖片附件，以及服務運作所需的標準請求資訊。App 不會自動將 IndexedDB 收藏內容或 JSON 備份傳送到表單。

請勿在表單中上傳 JSON 備份、私人收藏照片、密碼或其他敏感資料。表單回報會保留在專案擁有者的 Tally 工作區，直到由專案擁有者刪除；Tally 的資料處理另依其隱私政策辦理。

### 聯絡方式

一般隱私問題可使用[問題回報表單](https://tally.so/r/KYNy7M)或 repository 的 GitHub Issues。安全弱點請依 `SECURITY.md` 的非公開回報方式處理。

## English

### Data storage

ACG Collector is a local-first Progressive Web App. Collection and wishlist content is stored in IndexedDB in the user's current browser: series and character names, merchandise types, notes, and photos, plus each wishlist entry's name, shop, links, price and currency, order deadline, release time, priority, and status. The interface language and the last currency used are stored in the browser's localStorage. The application code does not send this content to a server operated by the project owner and does not include accounts, cloud synchronization, or analytics tracking.

The hosting provider may process standard HTTP request information, such as IP addresses, browser information, request times, and requested static files, as part of normal hosting operations. Hosting logs do not include collection or wishlist content stored in IndexedDB.

### Photos and backups

Supported browsers attempt to compress selected photos on the device before storing them in IndexedDB. Exported JSON backups are not encrypted and may contain collection and wishlist names, notes, links, prices, and photos encoded as Data URLs. Treat backup files as private data and store them securely.

Importing a backup replaces the current collection and wishlist after confirmation. A backup made before version 0.4.0 holds only the collection, so importing it keeps the current wishlist. The project owner cannot recover lost local data unless the user previously exported a backup.

### Retention and deletion

Data remains in storage associated with the current browser and website origin until the user deletes entries, clears site data, or the browser or operating system evicts the storage. A different browser, device, protocol, or domain uses a different storage area.

Users can delete all application data through their browser's site-data settings. Data may be unrecoverable after deletion if no backup was exported.

### External services

The application runtime does not load Google Fonts or another third-party font service. The production hosting provider supplies HTTPS and static file delivery and processes data under its own privacy policy.

### Wishlist links

Links saved in the wishlist, such as shop pages, open the external site in a new tab only when the user selects them. The app stores only http and https addresses, does not send its own address as the referrer when a link opens, and does not contact these sites or read their content on its own. Once opened, the site processes standard request information, such as the IP address and browser information, under its own privacy policy.

### Feedback form

The **Send feedback** link leaves the app and opens an external form provided by Tally. Tally receives the report content, optional contact email, optional image attachment, and standard request information needed to operate the service only when the user submits the form. The app does not automatically transfer IndexedDB collection content or JSON backups to the form.

Do not upload JSON backups, private collection photos, passwords, or other sensitive data. Form submissions remain in the project owner's Tally workspace until the project owner deletes them. Tally processes this data under its own privacy policy.

### Contact

Use the [feedback form](https://tally.so/r/KYNy7M) or the repository's GitHub Issues for general privacy questions. Report security vulnerabilities privately as described in `SECURITY.md`.
