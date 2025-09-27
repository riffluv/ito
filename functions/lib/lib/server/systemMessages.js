"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSystemPlayerName = resolveSystemPlayerName;
exports.systemMessagePlayerJoined = systemMessagePlayerJoined;
exports.systemMessagePlayerLeft = systemMessagePlayerLeft;
exports.systemMessageHostTransferred = systemMessageHostTransferred;
exports.systemMessageRoomBecameEmpty = systemMessageRoomBecameEmpty;
const DEFAULT_PLAYER_NAME = "名もなき冒険者";
const MAX_NAME_LENGTH = 16;
function sanitizeText(raw) {
    return raw
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .replace(/[\u2028\u2029]/g, " ")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
function normalizeName(raw) {
    if (!raw)
        return null;
    const cleaned = sanitizeText(raw);
    const normalized = cleaned.trim();
    if (!normalized)
        return null;
    if (normalized.length > MAX_NAME_LENGTH) {
        return normalized.slice(0, MAX_NAME_LENGTH) + "…";
    }
    return normalized;
}
function resolveSystemPlayerName(raw) {
    return normalizeName(raw);
}
function ensureDisplayName(raw) {
    return normalizeName(raw) ?? DEFAULT_PLAYER_NAME;
}
function systemMessagePlayerJoined(rawName) {
    const name = ensureDisplayName(rawName);
    return "✨ " + name + " がパーティに参加した！";
}
function systemMessagePlayerLeft(rawName) {
    const name = ensureDisplayName(rawName);
    return "👣 " + name + " がパーティから離脱しました。";
}
function systemMessageHostTransferred(rawName) {
    const name = ensureDisplayName(rawName);
    return "👑 " + name + " さんがホストになりました！";
}
function systemMessageRoomBecameEmpty() {
    return "🌙 だれもいなくなったので部屋を初期化しました。";
}
