"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateStore = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const types_1 = require("./types");
function emptyState() {
    return {
        version: 1,
        initialized: false,
        announce: '',
        newAnimeDigest: '',
        newAnimeList: [],
    };
}
class StateStore {
    file;
    logger;
    state = emptyState();
    constructor(file, logger) {
        this.file = file;
        this.logger = logger;
    }
    async load() {
        try {
            const raw = await node_fs_1.promises.readFile(this.file, 'utf8');
            const data = (0, types_1.asRecord)(JSON.parse(raw));
            if (!data)
                throw new TypeError('state root must be an object');
            this.state = {
                version: 1,
                initialized: data.initialized === true || !!data.announce || !!data.newAnimeDigest,
                announce: (0, types_1.asString)(data.announce),
                newAnimeDigest: (0, types_1.asString)(data.newAnimeDigest),
                newAnimeList: (0, types_1.asAnimeItems)(data.newAnimeList),
            };
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                this.logger.warn('无法读取状态文件，将重新建立基线：%s', formatError(error));
            }
            this.state = emptyState();
        }
        return this.state;
    }
    async save() {
        await node_fs_1.promises.mkdir((0, node_path_1.dirname)(this.file), { recursive: true });
        const temporaryFile = `${this.file}.${process.pid}.${Date.now()}.tmp`;
        await node_fs_1.promises.writeFile(temporaryFile, `${JSON.stringify(this.state, null, 2)}\n`, 'utf8');
        await node_fs_1.promises.rename(temporaryFile, this.file);
    }
}
exports.StateStore = StateStore;
function formatError(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=state.js.map