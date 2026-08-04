import { Context } from 'koishi';
import { Config as ConfigSchema, type Config as PluginConfig } from './config';
export declare const name = "baha-update-listener";
export declare const Config: import("schemastery")<ConfigSchema>;
export type Config = PluginConfig;
export declare const usage = "\n\u8A2D\u5B9A\u63A8\u9001\u76EE\u6A19\u5F8C\uFF0C\u63D2\u4EF6\u6703\u5B9A\u6642\u76E3\u807D\u5DF4\u54C8\u59C6\u7279\u52D5\u756B\u760B\u516C\u544A\u548C ON AIR \u66F4\u65B0\u3002\u9996\u6B21\u555F\u52D5\u53EA\u8A18\u9304\u76EE\u524D\u72C0\u614B\uFF0C\u4E0D\u63A8\u9001\u6B77\u53F2\u5167\u5BB9\u3002\n\n\u53EF\u7528\u6307\u4EE4\uFF1A\n- baha.announcement\n- baha.schedule [1-7/\u661F\u671F]\n- baha.anime <sn>\n";
export declare function apply(ctx: Context, config: PluginConfig): void;
//# sourceMappingURL=index.d.ts.map