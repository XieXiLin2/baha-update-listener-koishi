import { Context } from 'koishi';
import { Config as ConfigSchema, type Config as PluginConfig } from './config';
export declare const name = "baha-update-listener";
export declare const Config: import("schemastery")<ConfigSchema>;
export type Config = PluginConfig;
export declare const usage = "\n\u914D\u7F6E\u63A8\u9001\u76EE\u6807\u540E\uFF0C\u63D2\u4EF6\u4F1A\u5B9A\u65F6\u76D1\u542C\u5DF4\u54C8\u59C6\u7279\u52A8\u753B\u75AF\u516C\u544A\u548C ON AIR \u66F4\u65B0\u3002\u9996\u6B21\u542F\u52A8\u53EA\u8BB0\u5F55\u5F53\u524D\u72B6\u6001\uFF0C\u4E0D\u63A8\u9001\u5386\u53F2\u5185\u5BB9\u3002\n\n\u53EF\u7528\u6307\u4EE4\uFF1A\n- baha.announcement\n- baha.schedule [1-7/\u661F\u671F]\n- baha.anime <sn>\n";
export declare function apply(ctx: Context, config: PluginConfig): void;
//# sourceMappingURL=index.d.ts.map