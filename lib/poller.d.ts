import type { Context, Logger } from 'koishi';
import type { GamerApiClient } from './api';
import type { StateStore } from './state';
import type { PushTarget } from './types';
export interface PollerOptions {
    targets: PushTarget[];
    maxPushItems: number;
}
export declare class PollerService {
    private readonly ctx;
    private readonly logger;
    private readonly api;
    private readonly store;
    private readonly options;
    private polling;
    constructor(ctx: Context, logger: Logger, api: GamerApiClient, store: StateStore, options: PollerOptions);
    poll(): Promise<void>;
    private broadcast;
    private findBot;
}
//# sourceMappingURL=poller.d.ts.map