import type { Context } from 'koishi';
import type { BahaIndexResponse, BahaVideoResponse } from './types';
export interface GamerApiOptions {
    useMobileApi: boolean;
    webUserAgent: string;
    requestTimeout: number;
}
export declare class GamerApiClient {
    private readonly http;
    private readonly options;
    constructor(http: Context['http'], options: GamerApiOptions);
    fetchIndex(): Promise<BahaIndexResponse>;
    fetchVideo(sn: number): Promise<BahaVideoResponse>;
    private getJson;
    private buildHeaders;
}
//# sourceMappingURL=api.d.ts.map