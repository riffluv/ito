"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logDebug = logDebug;
exports.logInfo = logInfo;
exports.logWarn = logWarn;
exports.logError = logError;
const LEVEL_ORDER = ["silent", "error", "warn", "info", "debug"];
const LEVEL_RANK = new Map(LEVEL_ORDER.map((lvl, idx) => [lvl, idx]));
const DEFAULT_LEVEL = "info";
function parseLevel(raw) {
    if (!raw)
        return null;
    const normalized = raw.toLowerCase();
    return LEVEL_ORDER.includes(normalized) ? normalized : null;
}
// 環境変数を評価（サーバー側: LOG_LEVEL 優先 / クライアント側: NEXT_PUBLIC_LOG_LEVEL）
const SERVER_LEVEL = parseLevel(process.env.LOG_LEVEL) ?? parseLevel(process.env.NEXT_PUBLIC_LOG_LEVEL);
const CLIENT_LEVEL = parseLevel(process.env.NEXT_PUBLIC_LOG_LEVEL);
function currentLevel() {
    if (typeof window === "undefined") {
        return SERVER_LEVEL ?? DEFAULT_LEVEL;
    }
    return CLIENT_LEVEL ?? DEFAULT_LEVEL;
}
function enabled(level) {
    const current = currentLevel();
    const currentRank = LEVEL_RANK.get(current) ?? LEVEL_RANK.get(DEFAULT_LEVEL);
    const targetRank = LEVEL_RANK.get(level) ?? LEVEL_RANK.get(DEFAULT_LEVEL);
    return targetRank <= currentRank;
}
function emit(level, scope, msg, data) {
    if (!enabled(level === "debug" ? "debug" : level === "info" ? "info" : level === "warn" ? "warn" : "error")) {
        return;
    }
    const payload = data === undefined ? undefined : data;
    const prefix = `[${scope}] ${msg}`;
    switch (level) {
        case "debug":
            payload === undefined ? console.debug(prefix) : console.debug(prefix, payload);
            break;
        case "info":
            payload === undefined ? console.info(prefix) : console.info(prefix, payload);
            break;
        case "warn":
            payload === undefined ? console.warn(prefix) : console.warn(prefix, payload);
            break;
        case "error":
            payload === undefined ? console.error(prefix) : console.error(prefix, payload);
            break;
    }
}
function logDebug(scope, msg, data) {
    emit("debug", scope, msg, data);
}
function logInfo(scope, msg, data) {
    emit("info", scope, msg, data);
}
function logWarn(scope, msg, data) {
    emit("warn", scope, msg, data);
}
function logError(scope, msg, data) {
    emit("error", scope, msg, data);
}
