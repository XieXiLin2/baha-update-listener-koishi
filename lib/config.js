"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = void 0;
const koishi_1 = require("koishi");
const TargetSchema = koishi_1.Schema.object({
    platform: koishi_1.Schema.string()
        .required()
        .description('Koishi 平台名，例如 telegram、discord 或 onebot。'),
    selfId: koishi_1.Schema.string()
        .description('用于发送消息的机器人账号；留空时使用该平台的第一个机器人。'),
    channelId: koishi_1.Schema.string()
        .required()
        .description('接收更新通知的频道、群组或私聊 ID。'),
    guildId: koishi_1.Schema.string()
        .description('部分平台发送频道消息时需要的服务器 ID。'),
});
exports.Config = koishi_1.Schema.object({
    targets: koishi_1.Schema.array(TargetSchema)
        .role('table')
        .default([])
        .description('主动推送目标。留空时只注册查询指令，不启动轮询。'),
    pollIntervalSeconds: koishi_1.Schema.number()
        .min(15)
        .max(86400)
        .step(1)
        .default(60)
        .description('巴哈 API 轮询间隔，单位为秒。'),
    timezone: koishi_1.Schema.string()
        .default('Asia/Taipei')
        .description('排程默认日期和连载状态使用的 IANA 时区。'),
    useMobileApi: koishi_1.Schema.boolean()
        .default(true)
        .description('使用动画疯 Android 客户端请求头。'),
    webUserAgent: koishi_1.Schema.string()
        .default('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36')
        .description('关闭移动端请求头后使用的 User-Agent。'),
    requestTimeoutSeconds: koishi_1.Schema.number()
        .min(1)
        .max(120)
        .step(1)
        .default(20)
        .description('单次 API 请求超时，单位为秒。'),
    maxPushItems: koishi_1.Schema.number()
        .min(1)
        .max(30)
        .step(1)
        .default(12)
        .description('每次 ON AIR 通知最多包含的条目数。'),
    maxScheduleItems: koishi_1.Schema.number()
        .min(1)
        .max(100)
        .step(1)
        .default(30)
        .description('单日排程最多显示的条目数。'),
});
//# sourceMappingURL=config.js.map