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
配置推送目标后，插件会定时监听巴哈姆特动画疯公告和 ON AIR 更新。首次启动只记录当前状态，不推送历史内容。

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
    ctx.command('baha', '巴哈姆特动画疯查询')
        .action(() => [
        '可用指令：',
        '\nbaha.announcement - 查看当前公告',
        '\nbaha.schedule [星期] - 查看更新排程',
        '\nbaha.anime <sn> - 查询番剧详情',
    ].join(''));
    ctx.command('baha.announcement', '查看动画疯当前公告')
        .alias('announcement')
        .action(async () => {
        try {
            const announcement = (0, formatters_1.extractAnnouncement)(await api.fetchIndex());
            return announcement ? (0, messages_1.buildAnnouncementMessage)(announcement) : '目前没有公告。';
        }
        catch (error) {
            logger.warn('查询公告失败：%s', formatError(error));
            return formatQueryError(error);
        }
    });
    ctx.command('baha.schedule [day:string]', '查看动画疯每周更新排程')
        .alias('schedule')
        .example('baha.schedule')
        .example('baha.schedule 周五')
        .action(async (_, day) => {
        const dayKey = day ? (0, formatters_1.parseDayKey)(day) : (0, formatters_1.currentDayKey)(config.timezone);
        if (!dayKey)
            return '星期参数无效，请使用 1-7、mon-sun、周一至周日。';
        try {
            const schedule = (0, formatters_1.extractSchedule)(await api.fetchIndex());
            if (!Object.values(schedule).some((items) => items?.length))
                return '未取得排程信息。';
            return (0, messages_1.buildScheduleMessage)(dayKey, schedule[dayKey] ?? [], config.maxScheduleItems);
        }
        catch (error) {
            logger.warn('查询排程失败：%s', formatError(error));
            return formatQueryError(error);
        }
    });
    ctx.command('baha.anime <sn:string>', '查询动画疯影片详情')
        .alias('anime')
        .example('baha.anime 47927')
        .action(async (_, rawSn) => {
        if (rawSn?.toLowerCase() === 'schedule')
            return '请改用 baha.schedule。';
        const sn = parsePositiveInteger(rawSn);
        if (!sn)
            return '用法：baha.anime <正整数 sn>';
        try {
            const detail = (0, formatters_1.formatVideoDetail)(await api.fetchVideo(sn), config.timezone);
            return (0, messages_1.buildVideoDetailMessage)(detail);
        }
        catch (error) {
            logger.warn('查询番剧详情失败：%s', formatError(error));
            return formatQueryError(error);
        }
    });
    ctx.on('ready', async () => {
        await store.load();
        if (!config.targets.length) {
            logger.info('未配置推送目标，仅启用查询指令。');
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
    return status ? `查询失败：HTTP ${String(status)}` : '查询失败，请稍后重试。';
}
function formatError(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=index.js.map