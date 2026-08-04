export type UnknownRecord = Record<string, unknown>;
export interface AnimeItem extends UnknownRecord {
    title?: unknown;
    videoSn?: unknown;
    video_sn?: unknown;
    animeSn?: unknown;
    anime_sn?: unknown;
    acgSn?: unknown;
    acg_sn?: unknown;
    volume?: unknown;
    volumeString?: unknown;
    upTime?: unknown;
    upTimeHours?: unknown;
    scheduleTime?: unknown;
}
export interface BahaIndexResponse extends UnknownRecord {
    data?: unknown;
}
export interface BahaVideoResponse extends UnknownRecord {
    data?: unknown;
}
export interface PushTarget {
    platform: string;
    channelId: string;
    selfId?: string;
    guildId?: string;
}
export interface PersistedState {
    version: 1;
    initialized: boolean;
    announce: string;
    newAnimeDigest: string;
    newAnimeList: AnimeItem[];
}
export declare function asRecord(value: unknown): UnknownRecord | undefined;
export declare function asString(value: unknown): string;
export declare function asAnimeItems(value: unknown): AnimeItem[];
//# sourceMappingURL=types.d.ts.map