import type { AnimeItem, BahaIndexResponse, BahaVideoResponse } from './types';
export declare const WEEKDAY_NAMES: {
    readonly '1': "周一";
    readonly '2': "周二";
    readonly '3': "周三";
    readonly '4': "周四";
    readonly '5': "周五";
    readonly '6': "周六";
    readonly '7': "周日";
};
export type DayKey = keyof typeof WEEKDAY_NAMES;
export interface OnAirItem {
    title: string;
    animeSn: string;
    videoSn: string;
    timeText: string;
    volume: string;
}
export interface VideoDetail {
    title: string;
    cover: string;
    videoSn: string;
    animeSn: string;
    lines: string[];
}
export declare function extractAnnouncement(index: BahaIndexResponse): string;
export declare function extractNewAnimeList(index: BahaIndexResponse): AnimeItem[];
export declare function extractSchedule(index: BahaIndexResponse): Partial<Record<DayKey, AnimeItem[]>>;
export declare function animeItemKey(item: AnimeItem): string;
export declare function animeItemSignature(item: AnimeItem): [string, string, string, string];
export declare function newAnimeDigest(items: AnimeItem[]): string;
export declare function extractNewAnimeUpdates(oldItems: AnimeItem[], newItems: AnimeItem[]): AnimeItem[];
export declare function sortOnAirItems(items: AnimeItem[]): AnimeItem[];
export declare function formatOnAirItem(item: AnimeItem): OnAirItem;
export declare function formatVideoDetail(response: BahaVideoResponse, timezone: string, now?: Date): VideoDetail;
export declare function parseDayKey(raw?: string): DayKey | undefined;
export declare function currentDayKey(timezone: string, now?: Date): DayKey;
export declare function assertValidTimezone(timezone: string): void;
//# sourceMappingURL=formatters.d.ts.map