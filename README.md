# koishi-plugin-baha-update-listener

巴哈姆特動畫瘋、ABEMA 與 Crunchyroll（CR）動畫更新監聽 Koishi 插件。由原 `baha-update-listener` Telegram Bot 重寫，查詢與推送均使用 Koishi 的跨平台訊息介面。

## 功能

- 定時監聽動畫瘋公告與 ON AIR 條目變化。
- 透過 ABEMA 官方訪客 API 取得新作動畫排程，在節目到達排程時間後推送更新。
- 透過 CR 官方動畫 RSS 與 Release Calendar 取得排程和最近更新，並監聽官方公告分類。
- 查詢動畫瘋每週排程與目前公告，以及 ABEMA、CR 的每日排程與最近更新。
- 首次啟動僅建立狀態基線，不補發既有內容。
- 將更新推送到多個平台、機器人及頻道。
- 狀態寫入 `data/baha-update-listener/state.json`，重新啟動後仍可精確比較更新。
- 舊版 version 1、version 2 狀態檔會自動遷移至 version 3。

## 環境需求

- Node.js 20 或更新版本
- Koishi 4.18.11 或相容版本

## 安裝與建置

```powershell
npm install
npm run build
```

在 Koishi 應用程式目錄中安裝本機插件套件：

```powershell
npm install D:\Codes\baha-update-listener-koishi
```

也可以把本專案放入 Koishi 工作區的 `plugins` 目錄，再透過主控台啟用。

## 設定

| 設定項 | 預設值 | 說明 |
| --- | --- | --- |
| `targets` | `[]` | 主動推送目標；留空時只啟用查詢指令 |
| `plainTextPlatforms` | `[]` | 指定只使用純文字訊息的平台；ON AIR 與排程不附 URL |
| `pollIntervalSeconds` | `60` | 動畫瘋輪詢間隔，最短 15 秒 |
| `timezone` | `Asia/Taipei` | 訊息時間與動畫瘋排程使用的 IANA 時區 |
| `useMobileApi` | `true` | 是否使用動畫瘋 Android 請求標頭 |
| `webUserAgent` | Chrome UA | 動畫瘋網頁模式請求使用的 User-Agent |
| `requestTimeoutSeconds` | `20` | API 請求逾時秒數 |
| `maxPushItems` | `12` | 單次動畫瘋 ON AIR 通知條目上限 |
| `maxScheduleItems` | `30` | 單次排程查詢的顯示上限 |
| `enableAbema` | `true` | 是否啟用 ABEMA 定時輪詢；查詢指令仍會註冊 |
| `abemaPollIntervalSeconds` | `300` | ABEMA 輪詢間隔，最短 60 秒 |
| `abemaMaxPushItems` | `12` | 單次 ABEMA 更新通知條目上限 |
| `enableCr` | `true` | 是否啟用 CR 動畫更新與公告輪詢；查詢指令仍會註冊 |
| `crPollIntervalSeconds` | `300` | CR 動畫與公告輪詢間隔，最短 60 秒 |
| `crMaxPushItems` | `12` | 單次 CR 更新或公告通知條目上限 |

每個 `targets` 條目包含：

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `platform` | 是 | Koishi 平台名稱，例如 `telegram`、`discord`、`onebot` |
| `channelId` | 是 | 頻道、群組或私訊 ID |
| `selfId` | 否 | 指定機器人帳號；留空時使用該平台第一個機器人 |
| `guildId` | 否 | 部分平台傳送頻道訊息時需要的伺服器 ID |

設定範例：

```yaml
targets:
  - platform: telegram
    selfId: "123456789"
    channelId: "-1001234567890"
plainTextPlatforms:
  - onebot
pollIntervalSeconds: 60
timezone: Asia/Taipei
useMobileApi: true
enableAbema: true
abemaPollIntervalSeconds: 300
enableCr: true
crPollIntervalSeconds: 300
```

## 指令

| 指令 | 說明 |
| --- | --- |
| `baha` | 檢視動畫瘋當日更新排程 |
| `baha.announcement` | 檢視目前公告；別名 `announcement` |
| `baha.latest [數量]` | 檢視動畫瘋最近已更新的動畫 |
| `baha.schedule [星期]` | 檢視動畫瘋更新排程；別名 `schedule` |
| `abema` | 檢視 ABEMA 當日新作動畫排程 |
| `abema.latest [數量]` | 檢視目前排程中最近已更新的動畫 |
| `abema.schedule [日期]` | 檢視指定日期的新作動畫排程 |
| `cr` | 檢視 CR 當日動畫排程 |
| `cr.announcement` | 檢視 CR 官方公告分類中的最新文章 |
| `cr.latest [數量]` | 檢視 CR 最近已更新的動畫 |
| `cr.schedule [日期]` | 檢視指定日期的 CR 動畫排程 |

動畫瘋星期參數支援 `1-7`、`mon-sun`、`週一-週日` 與 `星期一-星期日`。ABEMA 與 CR 日期參數支援 `今天`、`明天`、`M/D` 與 `YYYY-MM-DD`。

## ABEMA 注意事項

- 插件使用 ABEMA 網頁目前採用的訪客授權流程，不需要帳號或 Cookie。
- 訪客存取權杖只保留在記憶體，不會寫入狀態檔或記錄檔。
- ABEMA 排程以日本時間為資料基準，訊息會依 `timezone` 轉換顯示時間。
- ABEMA 服務及 API 可能受地區限制；單一來源輪詢失敗不會中止另一來源。
- 若 ABEMA 日後調整網頁授權或資料模組，插件需要同步更新。

## CR 注意事項

- 插件內的 Crunchyroll 平台名稱與推送標題一律縮寫為 `CR`。
- 最近更新與自動提醒使用官方 `/rss/anime`；排程查詢會再嘗試合併官方 Release Calendar。
- Release Calendar 可能受地區、語言與 Cloudflare 瀏覽器驗證限制；日曆不可用時仍會使用 RSS 顯示已公布的更新。
- `cr.announcement` 與公告提醒只採用官方新聞 RSS 中標記為 `Announcements` 的文章，不包含一般新聞。
- CR 顯示內容會依來源判定的地區授權而異，時間則依 `timezone` 轉換。

## 開發檢查

```powershell
npm test
npm run typecheck
npm run build
npm pack --dry-run
```
