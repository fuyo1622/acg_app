# iPhone／Vercel 階段使用測試指南

最後更新：2026-07-21

## 先說結論

這個專案不是透過 App Store、TestFlight、Expo 或 Xcode 安裝的原生 iOS App，而是：

1. 將 React／Vite 專案部署到 **Vercel**。
2. 用 iPhone 的 **Safari** 開啟 Vercel 提供的 HTTPS 網址。
3. 從 Safari 選擇 **「加入主畫面」**，將網站安裝成 PWA。

安裝後會以接近 App 的獨立視窗開啟，但資料仍保存在該 iPhone、該網站網域的瀏覽器儲存空間（IndexedDB）內，不會自動同步到 Vercel 或其他裝置。

## 這階段的測試目標

這一輪以確認下列功能能在實機正常使用為主：

- Vercel 正式網址可以開啟，並能加入 iPhone 主畫面。
- App 圖示與獨立視窗顯示正常。
- 新增、查看、搜尋、篩選、編輯及刪除收藏品正常。
- 一筆收藏品可以包含多個系列及多個角色。
- 拍照或從相簿選圖後，圖片方向及顯示正常。
- 關閉後重開，資料仍存在。
- 已載入過 App 後，離線仍可開啟並讀取既有資料。
- 備份匯出與還原匯入正常。
- 部署新版後，同一個正式網域內的既有資料仍保留。

## 一、開始前先確認本機版本

在專案根目錄執行：

```powershell
npm.cmd install
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

如果你的 PowerShell 可以直接執行 `npm`，也可以把 `npm.cmd` 改成 `npm`。

2026-07-21 的本機基準結果：

- 自動測試：6 個測試檔、28 個測試全部通過。
- ESLint：通過。
- Production build：通過，並成功產生 `dist/manifest.webmanifest`、`dist/sw.js` 與其他 PWA 檔案。

注意：Vercel 只會部署 GitHub 上的內容，不會看到電腦中尚未 commit、尚未 push 的修改。準備測試哪個版本，就先確認該版本已安全地 commit 並 push 到預定分支。

## 二、從原本的 Vercel 專案取得測試網址

優先使用既有專案，因為同一個正式網域才能延續 iPhone 上原有的本機資料。

1. 登入 [Vercel Dashboard](https://vercel.com/dashboard)。
2. 尋找名稱接近 `acg-app`、`acg_app` 或連結到 GitHub repository `fuyo1622/acg_app` 的 Project。
3. 進入 Project 的 **Overview** 或 **Deployments**。
4. 找到狀態為 **Ready** 的最新 **Production** deployment。
5. 按 **Visit**，或到 **Settings → Domains** 複製正式網址。

請把本次資訊記在這裡：

- Production 網址：`________________________________________`
- 測試 commit：`________________________________________`
- Vercel deployment 狀態：`Ready / Failed / 其他：__________`

### Production 與 Preview 網址的差別

- **Production 網址**：作為主要實機測試與日常使用網址；通常固定指向 production branch（常見為 `main`）的最新版。
- **Preview 網址**：適合先看某個 branch／commit，但可能是另一個網域。

這個 App 的資料按「網站網域」分開保存。即使畫面和程式完全相同，Preview 與 Production 網址也可能各自看到不同資料。加入主畫面與長期資料保存請使用固定的 Production 網址，不要使用帶有隨機字串的單次 Preview 網址。

## 三、若 Vercel 中找不到舊專案

只有在確定找不到既有 Vercel Project 時才重新建立：

1. 在 Vercel Dashboard 按 **Add New… → Project**。
2. 連接 GitHub，匯入 `fuyo1622/acg_app`。
3. 確認設定：
   - Framework Preset：`Vite`
   - Root Directory：專案根目錄 `./`
   - Build Command：`npm run build`
   - Output Directory：`dist`
   - Install Command：使用 Vercel 自動偵測的預設值即可；若需手動填寫可用 `npm install`
   - Environment Variables：目前核心功能不需要
4. 按 **Deploy**，等狀態變成 **Ready**。
5. 開啟產生的 `https://...vercel.app` 網址，確認首頁可正常顯示。

如果 GitHub 已和 Vercel Project 連接，往 production branch（通常是 `main`）push 後，Vercel 會自動建立新的 Production deployment；其他 branch 通常會建立 Preview deployment。

## 四、安裝到 iPhone

1. 確認 iPhone 已連上網路。
2. 用 **Safari** 開啟上一步取得的 Production 網址，不要使用無痕瀏覽。
3. 等首頁完整載入一次。
4. 點 Safari 的 **分享**按鈕（方框加向上箭頭）。
5. 在分享選單中選 **加入主畫面**。
6. 名稱保留為 `ACG` 或自行調整，按右上角 **加入**。
7. 回到主畫面，點新的 ACG 圖示啟動。

預期結果：

- 主畫面顯示 ACG 圖示，而不是空白或預設網頁縮圖。
- 從圖示啟動後，以獨立視窗開啟，不顯示一般 Safari 網址列。
- 首頁可正常操作。

## 五、建議的實機測試順序

### 0. 保護舊資料

如果打開後已經有重要收藏資料，先按首頁的 **匯出備份**按鈕，確認 JSON 備份檔能在「檔案」App 中找到，再進行刪除、匯入或清除資料等測試。

不要在沒有備份的情況下：

- 清除 Safari 網站資料。
- 刪除後重新建立不同網域的 Vercel Project。
- 測試「匯入備份」的取代流程。
- 假設 Vercel 會保存收藏資料；Vercel 只託管前端程式。

### 1. 安裝外觀與語言

1. 從主畫面圖示開啟 App。
2. 確認沒有 Safari 網址列。
3. 切換繁體中文與 English。
4. 關閉 App 後重新開啟。

預期：圖示、標題及版面正常；語言選擇在重開後保留。

### 2. 表單驗證

1. 按右下角 `＋`。
2. 不填系列、角色及商品類型，直接儲存。
3. 再只填系列或只填角色，但仍不選商品類型。

預期：

- 系列與角色至少要有一項，否則不能儲存。
- 商品類型必填。
- 驗證訊息使用目前選取的語言。

### 3. 新增含多值與照片的收藏品

建立一筆容易辨識的測試資料，例如：

- 系列：`葬送的芙莉蓮`、`測試系列 B`
- 角色：`芙莉蓮`、`費倫`
- 類型：任一內建類型，或測試一個自訂類型
- 備註：`iPhone 階段測試 2026-07-21`
- 圖片：各測一次「拍照」與「從相簿選取」

預期：

- 可以新增多個系列及角色，也能各別移除。
- 儲存後回到首頁並看到新卡片。
- 圖片不應錯誤旋轉、被壓扁或無法顯示。
- 進入詳細頁後，所有系列、角色、類型及備註正確。

### 4. 搜尋與篩選

分別用以下方式找到剛新增的資料：

- 搜尋任一系列。
- 搜尋任一角色。
- 搜尋備註中的關鍵字。
- 依商品類型篩選。
- 依第二個系列及第二個角色篩選。

預期：所有搜尋與篩選都能命中多值欄位；清除條件後恢復完整清單。

### 5. 編輯與刪除

1. 進入詳細頁，再進入編輯頁。
2. 新增及移除部分系列／角色。
3. 修改類型與備註。
4. 更換照片並儲存。
5. 回到詳細頁確認內容更新。
6. 另建一筆純測試資料，測試刪除並確認提示。

預期：修改能保留，取消不應誤存；確認刪除後項目消失。

### 6. 關閉重開與離線

1. 正常連網時開啟 App，等畫面載入完成。
2. 從 App 切換器完全關閉。
3. 重新開啟，確認測試資料仍在。
4. 開啟飛航模式並關閉 Wi-Fi。
5. 再次從主畫面開啟 App。
6. 查看既有資料、搜尋與篩選，並嘗試新增一筆離線測試資料。
7. 恢復網路，關閉並重開一次。

預期：

- 關閉重開後資料仍在。
- 成功載入過的 App shell 在離線時可開啟。
- 既有本機資料可讀取，離線新增內容也能保留。

若第一次安裝後尚未完整載入就直接離線，離線啟動失敗不代表快取一定有問題；先連網完整開啟一次再重測。

### 7. 備份與還原

1. 記下目前項目數量並匯出 JSON 備份。
2. 在「檔案」App 中確認檔名類似 `acg-backup-YYYY-MM-DD.json`，且檔案大小不是 0。
3. 新增一筆「匯入後應消失」的臨時資料。
4. 按匯入按鈕，選擇剛才的 JSON。
5. 閱讀取代警告後確認匯入。

預期：匯入成功；臨時資料消失；備份當時的項目、照片與多值欄位完整恢復。

注意：匯入不是合併，而是用備份內容取代目前收藏。

### 8. 新版部署與資料保留

1. 保持目前 App 與測試資料，不要刪除主畫面圖示。
2. 將下一版 commit push 到 Vercel 的 production branch。
3. 到 Vercel 確認新 deployment 為 **Ready**。
4. iPhone 先連網開啟 App，等待一會兒，再完全關閉並重開。
5. 確認新畫面／功能出現，且舊資料仍在。

本專案的 service worker 設定為自動更新。若第一次開啟仍看到舊版，可在連網狀態多關閉並重開一次；不要先清除網站資料，否則可能連收藏資料一起刪除。

## 六、測試結果紀錄表

請用 `通過 / 失敗 / 未測` 填寫：

| 項目 | 結果 | 備註 |
| --- | --- | --- |
| Vercel Production deployment 為 Ready |  |  |
| Safari 可開啟 Production 網址 |  |  |
| 可加入主畫面 |  |  |
| 圖示與獨立視窗正常 |  |  |
| 中英文切換及保留 |  |  |
| 必填驗證正常 |  |  |
| 多系列／多角色新增正常 |  |  |
| 拍照與相簿圖片正常 |  |  |
| 詳細頁顯示正常 |  |  |
| 搜尋及三種篩選正常 |  |  |
| 編輯、換圖及刪除正常 |  |  |
| 關閉重開後資料保留 |  |  |
| 離線啟動與操作正常 |  |  |
| JSON 備份匯出正常 |  |  |
| JSON 取代式還原正常 |  |  |
| 部署新版後資料仍保留 |  |  |

## 七、常見問題

### Safari 找不到「加入主畫面」

- 確認使用 Safari，而不是 App 內建瀏覽器。
- 確認網址是 `https://`。
- 在分享選單往下捲；必要時選「編輯動作」加入此動作。
- 確認 Vercel deployment 沒有啟用會攔住一般訪客的保護頁。

### 加入主畫面後是舊圖示或舊版本

- 先在 Safari 連網重開 Production 網址。
- 完全關閉主畫面 App，再重新開啟。
- 圖示仍錯誤時才考慮移除並重新加入主畫面；先匯出資料備份。

### 換網址後資料不見

資料是依 origin（通訊協定、網域及連接埠）隔離的。Production、Preview、舊 Vercel Project 與新 Vercel Project 的網址可能使用不同資料庫。回到原本網址匯出備份，再到新網址匯入。

### 重新整理詳細頁或編輯頁出現 Vercel 404

本專案使用 `BrowserRouter`，目前根目錄沒有 `vercel.json` SPA rewrite。首頁內部導覽通常可用，但直接開啟或重新整理 `/item/...`、`/edit/...` 等深層網址時，Vercel 可能回傳 404。

請把它記為部署設定問題；常見修正是在根目錄加入：

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

這個檔案目前尚未加入專案；若本輪測試遇到此問題，再把它列為後續修正，不要誤判為資料遺失。

### 清除 Safari 資料後收藏消失

這是 local-first 架構的限制。若已清除 IndexedDB，只能從先前匯出的 JSON 備份還原；Vercel 沒有收藏資料的伺服器端副本。

## 八、回報問題時請附上

- iPhone 型號及 iOS 版本。
- 使用 Production 或 Preview 網址（附完整網址）。
- Vercel deployment／Git commit。
- 測試時是否連網、是否使用飛航模式。
- 從哪一步開始、做了哪些操作、預期結果與實際結果。
- 截圖或錄影。
- 問題發生後，關閉重開是否仍可重現。
- 是否涉及既有資料、匯入或清除網站資料。

## 官方參考

- [Vercel：Deploying Git Repositories](https://vercel.com/docs/git)
- [Vercel：Deploying to Vercel](https://vercel.com/docs/deployments/overview)
- [Vercel：Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel：Generated URLs](https://vercel.com/docs/deployments/generated-urls)

