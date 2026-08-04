"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asRecord = asRecord;
exports.asString = asString;
exports.asAnimeItems = asAnimeItems;
function asRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return;
    return value;
}
function asString(value) {
    if (value === undefined || value === null)
        return '';
    return String(value).trim();
}
function asAnimeItems(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => !!asRecord(item));
}
//# sourceMappingURL=types.js.map