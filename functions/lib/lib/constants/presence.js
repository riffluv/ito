"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESENCE_CLEANUP_INTERVAL_MS = exports.PRESENCE_HEARTBEAT_RETRY_DELAYS_MS = exports.MAX_CLOCK_SKEW_MS = exports.PRESENCE_STALE_MS = exports.PRESENCE_HEARTBEAT_MS = void 0;
const parseMs = (value) => {
    if (!value)
        return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0)
        return null;
    return Math.floor(num);
};
const pickMs = (keys, fallback) => {
    for (const key of keys) {
        const resolved = parseMs(process.env[key]);
        if (resolved !== null)
            return resolved;
    }
    return fallback;
};
exports.PRESENCE_HEARTBEAT_MS = pickMs(["NEXT_PUBLIC_PRESENCE_HEARTBEAT_MS", "PRESENCE_HEARTBEAT_MS"], 20000);
exports.PRESENCE_STALE_MS = (() => {
    const resolved = pickMs(["NEXT_PUBLIC_PRESENCE_STALE_MS", "PRESENCE_STALE_MS"], 120000);
    const minValue = exports.PRESENCE_HEARTBEAT_MS + 5000;
    return resolved < minValue ? minValue : resolved;
})();
exports.MAX_CLOCK_SKEW_MS = pickMs(["NEXT_PUBLIC_PRESENCE_MAX_CLOCK_SKEW_MS", "PRESENCE_MAX_CLOCK_SKEW_MS"], 30000);
exports.PRESENCE_HEARTBEAT_RETRY_DELAYS_MS = Object.freeze([3000, 9000, 27000]);
exports.PRESENCE_CLEANUP_INTERVAL_MS = pickMs(["PRESENCE_CLEANUP_INTERVAL_MS"], 60000);
