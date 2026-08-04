import { h } from 'koishi';
import type { AnimeItem } from './types';
import type { DayKey, VideoDetail } from './formatters';
export declare function buildAnnouncementMessage(announcement: string): h.Fragment;
export declare function buildOnAirMessage(items: AnimeItem[]): h.Fragment;
export declare function buildScheduleMessage(day: DayKey, items: AnimeItem[], maxItems: number): h.Fragment;
export declare function buildVideoDetailMessage(detail: VideoDetail): h.Fragment;
//# sourceMappingURL=messages.d.ts.map