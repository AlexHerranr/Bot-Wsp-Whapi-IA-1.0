export const getShortUserId = (jid: string): string => {
    if (typeof jid === 'string') {
        const cleaned = jid.split('@')[0] || jid;
        return cleaned;
    }
    return 'unknown';
};

export const cleanContactName = (rawName: any): string => {
    if (!rawName || typeof rawName !== 'string') return 'Usuario';

    let cleaned = rawName
        .trim()
        .replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF]/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    return cleaned.substring(0, 50) || 'Usuario';
};