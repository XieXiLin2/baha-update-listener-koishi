"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamerApiClient = void 0;
const INDEX_URL = 'https://api.gamer.com.tw/mobile_app/anime/v3/index.php';
const VIDEO_URL = 'https://api.gamer.com.tw/mobile_app/anime/v3/video.php';
const MOBILE_HEADERS = {
    'User-Agent': 'Animad/1.16.16 (tw.com.gamer.android.animad; build:328; Android 9) okHttp/4.4.0',
    'X-Bahamut-App-Android': 'tw.com.gamer.android.animad',
    'X-Bahamut-App-Version': '328',
    'Accept-Encoding': 'gzip',
    Connection: 'Keep-Alive',
};
class GamerApiClient {
    http;
    options;
    constructor(http, options) {
        this.http = http;
        this.options = options;
    }
    fetchIndex() {
        return this.getJson(INDEX_URL);
    }
    fetchVideo(sn) {
        return this.getJson(VIDEO_URL, sn);
    }
    getJson(url, sn) {
        return this.http.get(url, {
            headers: this.buildHeaders(sn),
            params: sn === undefined ? undefined : { sn },
            timeout: this.options.requestTimeout * 1000,
        });
    }
    buildHeaders(sn) {
        if (this.options.useMobileApi)
            return { ...MOBILE_HEADERS };
        const origin = 'https://ani.gamer.com.tw';
        return {
            'User-Agent': this.options.webUserAgent,
            Referer: sn === undefined ? `${origin}/` : `${origin}/animeVideo.php?sn=${sn}`,
            'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.6',
            Accept: 'application/json,text/plain,*/*',
            'Accept-Encoding': 'gzip, deflate',
            'Cache-Control': 'max-age=0',
            Origin: origin,
        };
    }
}
exports.GamerApiClient = GamerApiClient;
//# sourceMappingURL=api.js.map