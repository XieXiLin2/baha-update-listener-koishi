"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const koishi_1 = require("koishi");
const TargetSchema = koishi_1.Schema.object({
    platform: koishi_1.Schema.string()
        .required()
        .description('Koishi 平台名稱，例如 telegram、discord 或 onebot。'),
    selfId: koishi_1.Schema.string()
        .description('用於傳送訊息的機器人帳號；留空時使用該平台的第一個機器人。'),
    channelId: koishi_1.Schema.string()
        .required()
        .description('接收更新通知的頻道、群組或私訊 ID。'),
    guildId: koishi_1.Schema.string()
        .description('部分平台傳送頻道訊息時需要的伺服器 ID。'),
});
exports.Config = koishi_1.Schema.object({
    targets: koishi_1.Schema.array(TargetSchema)
        .role('table')
        .default([])
        .description('主動推送目標。留空時只註冊查詢指令，不啟動輪詢。'),
    pollIntervalSeconds: koishi_1.Schema.number()
        .min(15)
        .max(86400)
        .step(1)
        .default(60)
        .description('巴哈 API 輪詢間隔，單位為秒。'),
    timezone: koishi_1.Schema.string()
        .default('Asia/Taipei')
        .description('排程預設日期和連載狀態使用的 IANA 時區。'),
    useMobileApi: koishi_1.Schema.boolean()
        .default(true)
        .description('使用動畫瘋 Android 用戶端請求標頭。'),
    webUserAgent: koishi_1.Schema.string()
        .default('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
        .description('關閉行動端請求標頭後使用的 User-Agent。'),
    requestTimeoutSeconds: koishi_1.Schema.number()
        .min(1)
        .max(120)
        .step(1)
        .default(20)
        .description('單次 API 請求逾時，單位為秒。'),
    maxPushItems: koishi_1.Schema.number()
        .min(1)
        .max(30)
        .step(1)
        .default(12)
        .description('每次 ON AIR 通知最多包含的條目數。'),
    maxScheduleItems: koishi_1.Schema.number()
        .min(1)
        .max(100)
        .step(1)
        .default(30)
        .description('單日排程最多顯示的條目數。'),
});
//# sourceMappingURL=config.js.map