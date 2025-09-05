"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanContactName = exports.getShortUserId = void 0;
const getShortUserId = (jid) => {
    if (typeof jid === 'string') {
        const cleaned = jid.split('@')[0] || jid;
        return cleaned;
    }
    return 'unknown';
};
exports.getShortUserId = getShortUserId;
const cleanContactName = (rawName) => {
    if (!rawName || typeof rawName !== 'string')
        return 'Usuario';
    let cleaned = rawName
        .trim()
        .replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned.substring(0, 50) || 'Usuario';
};
exports.cleanContactName = cleanContactName;
