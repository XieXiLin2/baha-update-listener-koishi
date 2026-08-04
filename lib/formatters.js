"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WEEKDAY_NAMES = void 0;
exports.extractAnnouncement = extractAnnouncement;
exports.extractNewAnimeList = extractNewAnimeList;
exports.extractSchedule = extractSchedule;
exports.animeItemKey = animeItemKey;
exports.animeItemSignature = animeItemSignature;
exports.newAnimeDigest = newAnimeDigest;
exports.extractNewAnimeUpdates = extractNewAnimeUpdates;
exports.sortOnAirItems = sortOnAirItems;
exports.formatOnAirItem = formatOnAirItem;
exports.formatVideoDetail = formatVideoDetail;
exports.parseDayKey = parseDayKey;
exports.currentDayKey = currentDayKey;
exports.assertValidTimezone = assertValidTimezone;
const node_crypto_1 = require("node:crypto");
const types_1 = require("./types");
exports.WEEKDAY_NAMES = {
    '1': '周一',
    '2': '周二',
    '3': '周三',
    '4': '周四',
    '5': '周五',
    '6': '周六',
    '7': '周日',
};
function extractAnnouncement(index) {
    return (0, types_1.asString)((0, types_1.asRecord)(index.data)?.announce);
}
function extractNewAnimeList(index) {
    const newAnime = (0, types_1.asRecord)(index.data)?.newAnime;
    if (Array.isArray(newAnime))
        return (0, types_1.asAnimeItems)(newAnime);
    return (0, types_1.asAnimeItems)((0, types_1.asRecord)(newAnime)?.date);
}
function extractSchedule(index) {
    const rawSchedule = (0, types_1.asRecord)((0, types_1.asRecord)(index.data)?.newAnimeSchedule);
    if (!rawSchedule)
        return {};
    const schedule = {};
    for (const day of Object.keys(exports.WEEKDAY_NAMES)) {
        schedule[day] = (0, types_1.asAnimeItems)(rawSchedule[day]);
    }
    return schedule;
}
function animeItemKey(item) {
    for (const key of ['videoSn', 'video_sn', 'animeSn', 'anime_sn', 'acgSn', 'acg_sn', 'title']) {
        const value = (0, types_1.asString)(item[key]);
        if (value)
            return value;
    }
    return stableStringify(item);
}
function animeItemSignature(item) {
    return [
        animeItemKey(item),
        (0, types_1.asString)(item.volume ?? item.volumeString),
        (0, types_1.asString)(item.upTimeHours),
        (0, types_1.asString)(item.title),
    ];
}
function newAnimeDigest(items) {
    const payload = items
        .map((item) => {
        const [key, volume, time, title] = animeItemSignature(item);
        return { key, volume, time, title };
    })
        .sort((left, right) => left.key.localeCompare(right.key));
    return (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(payload)).digest('hex');
}
function extractNewAnimeUpdates(oldItems, newItems) {
    const previous = new Map(oldItems.map((item) => [animeItemKey(item), animeItemSignature(item)]));
    return newItems.filter((item) => {
        const oldSignature = previous.get(animeItemKey(item));
        return !oldSignature || !signaturesEqual(oldSignature, animeItemSignature(item));
    });
}
function sortOnAirItems(items) {
    return [...items].sort((left, right) => {
        const leftKey = `${(0, types_1.asString)(left.upTime)}\u0000${(0, types_1.asString)(left.upTimeHours)}`;
        const rightKey = `${(0, types_1.asString)(right.upTime)}\u0000${(0, types_1.asString)(right.upTimeHours)}`;
        return rightKey.localeCompare(leftKey);
    });
}
function formatOnAirItem(item) {
    return {
        title: (0, types_1.asString)(item.title) || '(无标题)',
        animeSn: (0, types_1.asString)(item.animeSn ?? item.anime_sn),
        videoSn: (0, types_1.asString)(item.videoSn ?? item.video_sn),
        timeText: (0, types_1.asString)(item.upTimeHours) || '--:--',
        volume: (0, types_1.asString)(item.volume ?? item.volumeString) || '?',
    };
}
function formatVideoDetail(response, timezone, now = new Date()) {
    const data = (0, types_1.asRecord)(response.data);
    const video = (0, types_1.asRecord)(data?.video) ?? {};
    const anime = (0, types_1.asRecord)(data?.anime) ?? {};
    const title = cleanTitle((0, types_1.asString)(video.title ?? anime.title) || '(无标题)');
    const cover = (0, types_1.asString)(video.cover ?? anime.cover);
    const videoSn = (0, types_1.asString)(video.video_sn ?? video.videoSn);
    const animeSn = (0, types_1.asString)(anime.anime_sn ?? anime.animeSn);
    const lines = [];
    if (video.duration !== undefined && video.duration !== null) {
        lines.push(`时长：${String(video.duration)} 分钟`);
    }
    if ((0, types_1.asString)(video.quality))
        lines.push(`画质：${(0, types_1.asString)(video.quality)}`);
    if ((0, types_1.asString)(anime.upload_time))
        lines.push(`更新时间：${(0, types_1.asString)(anime.upload_time)}`);
    const volumeIndex = toFiniteNumber(anime.volume_index);
    const totalVolume = toFiniteNumber(anime.total_volume);
    if (volumeIndex !== undefined && totalVolume !== undefined) {
        const seasonEnd = (0, types_1.asString)(anime.season_end);
        const status = isAiring(seasonEnd, timezone, now) ? '连载中' : `共 ${totalVolume} 集`;
        lines.push(`集数：第 ${volumeIndex + 1} 集 / ${status}`);
    }
    if ((0, types_1.asString)(anime.publisher))
        lines.push(`发行：${(0, types_1.asString)(anime.publisher)}`);
    if ((0, types_1.asString)(anime.maker))
        lines.push(`制作：${(0, types_1.asString)(anime.maker)}`);
    if (anime.score !== undefined && anime.score !== null)
        lines.push(`评分：${String(anime.score)}`);
    const tags = Array.isArray(anime.tags) ? anime.tags.map(types_1.asString).filter(Boolean) : [];
    if (tags.length)
        lines.push(`标签：${tags.join('、')}`);
    if ((0, types_1.asString)(video.rating_desc))
        lines.push(`分级：${(0, types_1.asString)(video.rating_desc)}`);
    const content = (0, types_1.asString)(anime.content);
    if (content) {
        const summary = content.length > 450 ? `${content.slice(0, 450)}...` : content;
        lines.push('', '简介', summary);
    }
    return { title, cover, videoSn, animeSn, lines };
}
function parseDayKey(raw) {
    if (!raw)
        return;
    const normalized = raw.trim().toLowerCase();
    const mapping = {
        '1': '1', mon: '1', '周一': '1', '週一': '1', '星期一': '1',
        '2': '2', tue: '2', '周二': '2', '週二': '2', '星期二': '2',
        '3': '3', wed: '3', '周三': '3', '週三': '3', '星期三': '3',
        '4': '4', thu: '4', '周四': '4', '週四': '4', '星期四': '4',
        '5': '5', fri: '5', '周五': '5', '週五': '5', '星期五': '5',
        '6': '6', sat: '6', '周六': '6', '週六': '6', '星期六': '6',
        '7': '7', sun: '7', '周日': '7', '週日': '7', '星期日': '7',
    };
    return mapping[normalized];
}
function currentDayKey(timezone, now = new Date()) {
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' })
        .format(now)
        .toLowerCase();
    return parseDayKey(weekday) ?? '1';
}
function assertValidTimezone(timezone) {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
}
function signaturesEqual(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}
function stableStringify(value) {
    if (Array.isArray(value))
        return `[${value.map(stableStringify).join(',')}]`;
    const record = (0, types_1.asRecord)(value);
    if (!record)
        return JSON.stringify(value) ?? String(value);
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}
function cleanTitle(title) {
    return title.replace(/\s*\[\d+]\s*$/, '').trim();
}
function toFiniteNumber(value) {
    if (value === '' || value === null || value === undefined)
        return;
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}
function isAiring(seasonEnd, timezone, now) {
    const match = /^(\d{4})[/-](\d{2})[/-](\d{2})$/.exec(seasonEnd);
    if (!match)
        return false;
    const endKey = `${match[1]}-${match[2]}-${match[3]}`;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const value = (type) => parts.find((part) => part.type === type)?.value ?? '';
    const todayKey = `${value('year')}-${value('month')}-${value('day')}`;
    return endKey >= todayKey;
}
//# sourceMappingURL=formatters.js.map