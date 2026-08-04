# koishi-plugin-baha-update-listener

巴哈姆特動畫瘋更新監聽 Koishi 插件。由原 `baha-update-listener` Telegram Bot 重寫而來，查詢和推送均使用 Koishi 的跨平台訊息介面。

## 功能

- 定時輪詢動畫瘋首頁 API，監聽公告和 ON AIR 條目變化。
- 首次啟動僅建立狀態基線，不推送現有歷史內容。
- 將更新推送到多個平台、機器人和頻道。
- 查詢目前公告、每週更新排程和指定影片詳情。
- 狀態寫入 `data/baha-update-listener/state.json`，重新啟動後仍可精確比較更新。
- 支援行動端請求標頭和自訂 Web User-Agent。

## 環境需求

- Node.js 20 或更高版本
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

也可以將本儲存庫放入 Koishi 工作區的 `plugins` 目錄後，透過主控台啟用。

## 設定

核心設定如下：

| 設定項 | 預設值 | 說明 |
| --- | --- | --- |
| `targets` | `[]` | 主動推送目標；留空時只啟用查詢指令 |
| `pollIntervalSeconds` | `60` | 輪詢間隔，最短 15 秒 |
| `timezone` | `Asia/Taipei` | IANA 時區名稱 |
| `useMobileApi` | `true` | 是否使用動畫瘋 Android 請求標頭 |
| `webUserAgent` | Chrome UA | Web 請求標頭模式使用的 User-Agent |
| `requestTimeoutSeconds` | `20` | API 請求逾時秒數 |
| `maxPushItems` | `12` | 單次 ON AIR 通知條目上限 |
| `maxScheduleItems` | `30` | 單日排程顯示上限 |

每個 `targets` 條目包含：

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `platform` | 是 | Koishi 平台名稱，例如 `telegram`、`discord`、`onebot` |
| `channelId` | 是 | 頻道、群組或私訊 ID |
| `selfId` | 否 | 指定機器人帳號；留空時使用該平台第一個機器人 |
| `guildId` | 否 | 某些平台傳送頻道訊息所需的伺服器 ID |

設定範例：

```yaml
targets:
  - platform: telegram
    selfId: "123456789"
    channelId: "-1001234567890"
  - platform: discord
    channelId: "123456789012345678"
    guildId: "987654321098765432"
pollIntervalSeconds: 60
timezone: Asia/Taipei
useMobileApi: true
```

## 指令

| 指令 | 說明 |
| --- | --- |
| `baha` | 顯示插件指令說明 |
| `baha.announcement` | 檢視目前公告，別名 `announcement` |
| `baha.schedule [星期]` | 檢視更新排程，別名 `schedule` |
| `baha.anime <sn>` | 查詢影片詳情，別名 `anime` |

排程星期參數支援 `1-7`、`mon-sun`、`周一-周日`、`週一-週日` 和 `星期一-星期日`。省略參數時使用設定時區中的當天。

## 開發檢查

```powershell
npm test
npm run typecheck
npm run build
npm pack --dry-run
```
