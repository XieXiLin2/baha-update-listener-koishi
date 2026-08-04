"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PollerService = void 0;
const formatters_1 = require("./formatters");
const messages_1 = require("./messages");
class PollerService {
    ctx;
    logger;
    api;
    store;
    options;
    polling = false;
    constructor(ctx, logger, api, store, options) {
        this.ctx = ctx;
        this.logger = logger;
        this.api = api;
        this.store = store;
        this.options = options;
    }
    async poll() {
        if (this.polling) {
            this.logger.debug('上一次輪詢尚未完成，跳過本輪。');
            return;
        }
        this.polling = true;
        try {
            const index = await this.api.fetchIndex();
            const announcement = (0, formatters_1.extractAnnouncement)(index);
            const animeList = (0, formatters_1.extractNewAnimeList)(index);
            const digest = (0, formatters_1.newAnimeDigest)(animeList);
            const state = this.store.state;
            if (!state.initialized) {
                Object.assign(state, {
                    initialized: true,
                    announce: announcement,
                    newAnimeDigest: digest,
                    newAnimeList: animeList,
                });
                await this.store.save();
                this.logger.info('已建立初始狀態，本次不推送歷史內容。');
                return;
            }
            let changed = false;
            if (announcement && announcement !== state.announce) {
                this.logger.info('偵測到動畫瘋公告更新。');
                await this.broadcast((0, messages_1.buildAnnouncementMessage)(announcement));
                state.announce = announcement;
                changed = true;
            }
            if (digest !== state.newAnimeDigest) {
                const updates = state.newAnimeList.length
                    ? (0, formatters_1.extractNewAnimeUpdates)(state.newAnimeList, animeList)
                    : animeList.slice(0, this.options.maxPushItems);
                const validUpdates = (0, formatters_1.sortOnAirItems)(updates)
                    .filter((item) => item.videoSn || item.video_sn)
                    .slice(0, this.options.maxPushItems);
                if (validUpdates.length) {
                    this.logger.info('偵測到 %d 項 ON AIR 更新。', validUpdates.length);
                    await this.broadcast((0, messages_1.buildOnAirMessage)(validUpdates));
                }
                else {
                    this.logger.debug('ON AIR 指紋發生變化，但沒有可推送的有效條目。');
                }
                state.newAnimeDigest = digest;
                state.newAnimeList = animeList;
                changed = true;
            }
            if (changed)
                await this.store.save();
        }
        catch (error) {
            this.logger.error('輪詢巴哈動畫瘋失敗：%s', formatError(error));
        }
        finally {
            this.polling = false;
        }
    }
    async broadcast(content) {
        const targets = uniqueTargets(this.options.targets);
        for (const target of targets) {
            const bot = this.findBot(target);
            if (!bot) {
                this.logger.warn('找不到推送機器人：platform=%s selfId=%s channelId=%s', target.platform, target.selfId || '(任意)', target.channelId);
                continue;
            }
            try {
                await bot.sendMessage(target.channelId, content, target.guildId);
            }
            catch (error) {
                this.logger.error('推送失敗：platform=%s selfId=%s channelId=%s error=%s', target.platform, bot.selfId, target.channelId, formatError(error));
            }
        }
    }
    findBot(target) {
        return this.ctx.bots.find((bot) => (bot.platform === target.platform && (!target.selfId || bot.selfId === target.selfId)));
    }
}
exports.PollerService = PollerService;
function uniqueTargets(targets) {
    const seen = new Set();
    return targets.filter((target) => {
        const key = [target.platform, target.selfId ?? '', target.channelId, target.guildId ?? ''].join('\u0000');
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function formatError(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=poller.js.map