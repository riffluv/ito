"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVATAR_LIST = void 0;
exports.getAvatarByOrder = getAvatarByOrder;
exports.randomAvatar = randomAvatar;
exports.hashCode = hashCode;
exports.range = range;
exports.sortPlayersByJoinOrder = sortPlayersByJoinOrder;
// アバター配列（参加順で配布）
exports.AVATAR_LIST = [
    "/avatars/knight1.webp",
    "/avatars/knightwomen1.webp",
    "/avatars/kenja.webp",
    "/avatars/kenshi.webp",
    "/avatars/mahou.webp",
    "/avatars/siifu.webp",
    "/avatars/arrow.webp",
    "/avatars/guitar.webp",
    "/avatars/ankoku.webp",
];
// 参加順でアバターを取得（重複なし）
function getAvatarByOrder(playerCount) {
    return exports.AVATAR_LIST[playerCount % exports.AVATAR_LIST.length];
}
// 既存の名前ベースアバター（後方互換性のため残す）
function randomAvatar(name) {
    const idx = Math.abs(hashCode(name)) % exports.AVATAR_LIST.length;
    return exports.AVATAR_LIST[idx];
}
function hashCode(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++)
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h;
}
function range(n) {
    return Array.from({ length: n }, (_, i) => i);
}
const hasSeconds = (value) => typeof value === "object" && value !== null && typeof value.seconds === "number";
const hasToMillis = (value) => typeof value === "object" &&
    value !== null &&
    typeof value.toMillis === "function";
function toSeconds(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === "number")
        return value;
    if (hasSeconds(value) && typeof value.seconds === "number") {
        return value.seconds;
    }
    if (hasToMillis(value) && typeof value.toMillis === "function") {
        try {
            return Math.floor((value.toMillis() ?? 0) / 1000);
        }
        catch {
            return null;
        }
    }
    return null;
}
// 入室順でプレイヤーIDをソートする関数
function sortPlayersByJoinOrder(playerIds, players) {
    const playerMap = new Map(players.map((p) => [p.id, p]));
    return [...playerIds].sort((a, b) => {
        const playerA = playerMap.get(a);
        const playerB = playerMap.get(b);
        const joinedA = toSeconds(playerA?.joinedAt);
        const joinedB = toSeconds(playerB?.joinedAt);
        if (joinedA !== null && joinedB !== null && joinedA !== joinedB) {
            return joinedA - joinedB;
        }
        const lastSeenA = toSeconds(playerA?.lastSeen);
        const lastSeenB = toSeconds(playerB?.lastSeen);
        if (lastSeenA !== null && lastSeenB !== null && lastSeenA !== lastSeenB) {
            return lastSeenA - lastSeenB;
        }
        return playerIds.indexOf(a) - playerIds.indexOf(b);
    });
}
