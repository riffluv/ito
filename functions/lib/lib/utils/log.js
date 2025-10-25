"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logDebug = logDebug;
exports.logInfo = logInfo;
exports.logWarn = logWarn;
exports.logError = logError;
const LEVEL_ORDER = ["silent", "error", "warn", "info", "debug"];
const LEVEL_RANK = new Map(LEVEL_ORDER.map((lvl, idx) => [lvl, idx]));
const DEFAULT_LEVEL = "info";
const isProdBuild = process.env.NODE_ENV === "production";
const isVercel = process.env.VERCEL === "1";
function parseLevel(raw) {
    if (!raw)
        return null;
    const normalized = raw.toLowerCase();
    return LEVEL_ORDER.includes(normalized)
        ? normalized
        : null;
}
// 環境変数を評価（サーバー側: LOG_LEVEL 優先 / クライアント側: NEXT_PUBLIC_LOG_LEVEL）
const SERVER_ENV_LEVEL = parseLevel(process.env.LOG_LEVEL) ??
    parseLevel(process.env.NEXT_PUBLIC_LOG_LEVEL);
const CLIENT_ENV_LEVEL = parseLevel(process.env.NEXT_PUBLIC_LOG_LEVEL);
const DEFAULT_SERVER_LEVEL = isVercel || isProdBuild ? "warn" : DEFAULT_LEVEL;
const DEFAULT_CLIENT_LEVEL = isProdBuild ? "warn" : DEFAULT_LEVEL;
function currentLevel() {
    if (typeof window === "undefined") {
        return SERVER_ENV_LEVEL ?? DEFAULT_SERVER_LEVEL;
    }
    return CLIENT_ENV_LEVEL ?? DEFAULT_CLIENT_LEVEL;
}
function enabled(level) {
    const current = currentLevel();
    const currentRank = LEVEL_RANK.get(current) ?? LEVEL_RANK.get(DEFAULT_LEVEL);
    const targetRank = LEVEL_RANK.get(level) ?? LEVEL_RANK.get(DEFAULT_LEVEL);
    return targetRank <= currentRank;
}
function emit(level, scope, msg, data) {
    if (!enabled(level)) {
        return;
    }
    const payload = data === undefined ? undefined : data;
    const prefix = `[${scope}] ${msg}`;
    switch (level) {
        case "debug":
            if (payload === undefined) {
                console.debug(prefix);
            }
            else {
                console.debug(prefix, payload);
            }
            break;
        case "info":
            if (payload === undefined) {
                console.info(prefix);
            }
            else {
                console.info(prefix, payload);
            }
            break;
        case "warn":
            if (payload === undefined) {
                console.warn(prefix);
            }
            else {
                console.warn(prefix, payload);
            }
            break;
        case "error":
            if (payload === undefined) {
                console.error(prefix);
            }
            else {
                console.error(prefix, payload);
            }
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
