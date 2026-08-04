"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usage = exports.Config = exports.name = void 0;
exports.apply = apply;
const node_path_1 = require("node:path");
const koishi_1 = require("koishi");
const api_1 = require("./api");
const config_1 = require("./config");
const formatters_1 = require("./formatters");
const messages_1 = require("./messages");
const poller_1 = require("./poller");
const state_1 = require("./state");
const types_1 = require("./types");
exports.name = 'baha-update-listener';
exports.Config = config_1.Config;
exports.usage = `
設定推送目標後，插件會定時監聽巴哈姆特動畫瘋公告和 ON AIR 更新。首次啟動只記錄目前狀態，不推送歷史內容。

可用指令：
- baha.announcement
- baha.schedule [1-7/星期]
- baha.anime <sn>
`;
function apply(ctx, config) {
    (0, formatters_1.assertValidTimezone)(config.timezone);
    const logger = new koishi_1.Logger(exports.name);
    const api = new api_1.GamerApiClient(ctx.http, {
        useMobileApi: config.useMobileApi,
        webUserAgent: config.webUserAgent,
        requestTimeout: config.requestTimeoutSeconds,
    });
    const stateFile = (0, node_path_1.join)(ctx.baseDir, 'data', exports.name, 'state.json');
    const store = new state_1.StateStore(stateFile, logger);
    const poller = new poller_1.PollerService(ctx, logger, api, store, {
        targets: config.targets,
        maxPushItems: config.maxPushItems,
    });
    ctx.command('baha', '巴哈姆特動畫瘋查詢')
        .action(() => [
        '可用指令：',
        '\nbaha.announcement - 檢視目前公告',
        '\nbaha.schedule [星期] - 檢視更新排程',
        '\nbaha.anime <sn> - 查詢番劇詳情',
    ].join(''));
    ctx.command('baha.announcement', '檢視動畫瘋目前公告')
        .alias('announcement')
        .action(async () => {
        try {
            const announcement = (0, formatters_1.extractAnnouncement)(await api.fetchIndex());
            return announcement ? (0, messages_1.buildAnnouncementMessage)(announcement) : '目前沒有公告。';
        }
        catch (error) {
            logger.warn('查詢公告失敗：%s', formatError(error));
            return formatQueryError(error);
        }
    });
    ctx.command('baha.schedule [day:string]', '檢視動畫瘋每週更新排程')
        .alias('schedule')
        .example('baha.schedule')
        .example('baha.schedule 週五')
        .action(async (_, day) => {
        const dayKey = day ? (0, formatters_1.parseDayKey)(day) : (0, formatters_1.currentDayKey)(config.timezone);
        if (!dayKey)
            return '星期參數無效，請使用 1-7、mon-sun、週一至週日。';
        try {
            const schedule = (0, formatters_1.extractSchedule)(await api.fetchIndex());
            if (!Object.values(schedule).some((items) => items?.length))
                return '未取得排程資訊。';
            return (0, messages_1.buildScheduleMessage)(dayKey, schedule[dayKey] ?? [], config.maxScheduleItems);
        }
        catch (error) {
            logger.warn('查詢排程失敗：%s', formatError(error));
            return formatQueryError(error);
        }
    });
    ctx.command('baha.anime <sn:string>', '查詢動畫瘋影片詳情')
        .alias('anime')
        .example('baha.anime 47927')
        .action(async (_, rawSn) => {
        if (rawSn?.toLowerCase() === 'schedule')
            return '請改用 baha.schedule。';
        const sn = parsePositiveInteger(rawSn);
        if (!sn)
            return '用法：baha.anime <正整數 sn>';
        try {
            const detail = (0, formatters_1.formatVideoDetail)(await api.fetchVideo(sn), config.timezone);
            return (0, messages_1.buildVideoDetailMessage)(detail);
        }
        catch (error) {
            logger.warn('查詢番劇詳情失敗：%s', formatError(error));
            return formatQueryError(error);
        }
    });
    ctx.on('ready', async () => {
        await store.load();
        if (!config.targets.length) {
            logger.info('未設定推送目標，僅啟用查詢指令。');
            return;
        }
        ctx.setInterval(() => void poller.poll(), config.pollIntervalSeconds * 1000);
        await poller.poll();
    });
}
function parsePositiveInteger(raw) {
    if (!raw || !/^\d+$/.test(raw))
        return;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value <= 0)
        return;
    return value;
}
function formatQueryError(error) {
    const response = (0, types_1.asRecord)((0, types_1.asRecord)(error)?.response);
    const status = response?.status;
    return status ? `查詢失敗：HTTP ${String(status)}` : '查詢失敗，請稍後重試。';
}
function formatError(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=index.js.map