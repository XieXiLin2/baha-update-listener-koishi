"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAnnouncementMessage = buildAnnouncementMessage;
exports.buildOnAirMessage = buildOnAirMessage;
exports.buildScheduleMessage = buildScheduleMessage;
exports.buildVideoDetailMessage = buildVideoDetailMessage;
const koishi_1 = require("koishi");
const formatters_1 = require("./formatters");
function buildAnnouncementMessage(announcement) {
    return [
        (0, koishi_1.h)('b', {}, '巴哈姆特動畫瘋'),
        '\n',
        announcement,
        '\n\n#announcement #baha',
    ];
}
function buildOnAirMessage(items) {
    const content = [(0, koishi_1.h)('b', {}, 'ON AIR >> [Baha]'), '\n'];
    for (const item of items) {
        const info = (0, formatters_1.formatOnAirItem)(item);
        if (!info.videoSn)
            continue;
        const videoUrl = `https://ani.gamer.com.tw/animeVideo.php?sn=${encodeURIComponent(info.videoSn)}`;
        content.push('\n- ', (0, koishi_1.h)('a', { href: videoUrl }, `[${info.timeText}] ${info.title}`), ' - ', (0, koishi_1.h)('a', { href: videoUrl }, info.volume));
    }
    content.push('\n\n#baha');
    return content;
}
function buildScheduleMessage(day, items, maxItems) {
    const content = [(0, koishi_1.h)('b', {}, `【${formatters_1.WEEKDAY_NAMES[day]}】`)];
    for (const item of items.slice(0, maxItems)) {
        const title = String(item.title ?? '').trim() || '(無標題)';
        const rawTime = String(item.scheduleTime ?? '').trim();
        const timeText = /^\d{1,2}:\d{2}/.exec(rawTime)?.[0].padStart(5, '0') ?? '--:--';
        const videoSn = String(item.videoSn ?? item.video_sn ?? '').trim();
        const animeSn = String(item.animeSn ?? item.anime_sn ?? '').trim();
        const label = `[${timeText}] ${title}`;
        content.push('\n- ');
        if (videoSn) {
            content.push((0, koishi_1.h)('a', {
                href: `https://ani.gamer.com.tw/animeVideo.php?sn=${encodeURIComponent(videoSn)}`,
            }, label));
        }
        else {
            content.push(label);
        }
        if (animeSn) {
            content.push(' (', (0, koishi_1.h)('a', {
                href: `https://ani.gamer.com.tw/animeRef.php?sn=${encodeURIComponent(animeSn)}`,
            }, '詳情'), ')');
        }
    }
    if (!items.length)
        content.push('\n- 當天暫無排程');
    if (items.length > maxItems)
        content.push(`\n- 另有 ${items.length - maxItems} 項未顯示`);
    return content;
}
function buildVideoDetailMessage(detail) {
    const content = [];
    if (detail.cover)
        content.push((0, koishi_1.h)('img', { src: detail.cover }), '\n');
    content.push((0, koishi_1.h)('b', {}, detail.title));
    if (detail.lines.length)
        content.push('\n', detail.lines.join('\n'));
    const links = [];
    if (detail.videoSn) {
        links.push((0, koishi_1.h)('a', {
            href: `https://ani.gamer.com.tw/animeVideo.php?sn=${encodeURIComponent(detail.videoSn)}`,
        }, '觀看最新一集'));
    }
    if (detail.animeSn) {
        if (links.length)
            links.push(' | ');
        links.push((0, koishi_1.h)('a', {
            href: `https://ani.gamer.com.tw/animeRef.php?sn=${encodeURIComponent(detail.animeSn)}`,
        }, '檢視番劇詳情'));
    }
    if (links.length)
        content.push('\n\n', ...links);
    return content;
}
//# sourceMappingURL=messages.js.map