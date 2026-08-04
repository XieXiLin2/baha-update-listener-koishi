import { Schema } from 'koishi';
import type { PushTarget } from './types';
export interface Config {
    targets: PushTarget[];
    pollIntervalSeconds: number;
    timezone: string;
    useMobileApi: boolean;
    webUserAgent: string;
    requestTimeoutSeconds: number;
    maxPushItems: number;
    maxScheduleItems: number;
}
export declare const Config: Schema<Config>;
//# sourceMappingURL=config.d.ts.map