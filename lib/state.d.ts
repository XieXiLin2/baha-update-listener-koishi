import type { Logger } from 'koishi';
import type { PersistedState } from './types';
export declare class StateStore {
    private readonly file;
    private readonly logger;
    state: PersistedState;
    constructor(file: string, logger: Logger);
    load(): Promise<PersistedState>;
    save(): Promise<void>;
}
//# sourceMappingURL=state.d.ts.map