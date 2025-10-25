"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onRoomWaitingProcessRejoins = exports.onRejoinRequestCreate = exports.pruneOldEvents = exports.onPlayerCreated = exports.purgeOrphanRooms = exports.onPlayerDeleted = exports.purgeChatOnRoundStart = exports.pruneIdleRooms = exports.presenceCleanup = exports.cleanupGhostRooms = exports.pruneOldChat = exports.cleanupExpiredRooms = exports.onPresenceWrite = exports.onPlayerUpdate = void 0;
const presence_1 = require("@/lib/constants/presence");
const roomActions_1 = require("@/lib/server/roomActions");
const systemMessages_1 = require("@/lib/server/systemMessages");
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
// Initialize admin if not already
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const rtdb = admin.database ? admin.database() : null;
// 緊急停止フラグ（READ 増加時の一時対策）
// 環境変数 EMERGENCY_READS_FREEZE=1 が有効のとき、
// 以降の定期ジョブ/トリガは早期 return して何もしない
const EMERGENCY_STOP = process.env.EMERGENCY_READS_FREEZE === "1";
const PRESENCE_STALE_THRESHOLD_MS = presence_1.PRESENCE_STALE_MS;
const DEBUG_LOGGING_ENABLED = process.env.ENABLE_FUNCTIONS_DEBUG_LOGS === "1" ||
    process.env.NODE_ENV !== "production";
const logDebug = DEBUG_LOGGING_ENABLED ? (...args) => console.debug(...args) : () => { };
function toMillis(value) {
    if (!value)
        return 0;
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (value instanceof Date) {
        return value.getTime();
    }
    if (typeof value?.toMillis === "function") {
        try {
            return value.toMillis();
        }
        catch {
            return 0;
        }
    }
    return 0;
}
/**
 * Recalculates playersCount and lastActive for a room.
 * Called after onCreate/onDelete/onUpdate of players docs.
 */
async function recalcRoomCounts(roomId) {
    if (!roomId)
        return;
    const playersColl = db.collection("rooms").doc(roomId).collection("players");
    // Count active players and compute lastSeen timestamp
    const snapshot = await playersColl.get();
    let count = 0;
    let lastSeen = null;
    snapshot.forEach((doc) => {
        count += 1;
        const data = doc.data();
        if (data.lastSeen && data.lastSeen.toDate) {
            const ts = data.lastSeen;
            if (!lastSeen || ts.toMillis() > lastSeen.toMillis())
                lastSeen = ts;
        }
    });
    const roomRef = db.collection("rooms").doc(roomId);
    const updates = { playersCount: count };
    if (lastSeen)
        updates.playersLastActive = lastSeen;
    // Use transaction for safety (ensure we don't stomp other concurrent updates)
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists)
            return;
        tx.update(roomRef, updates);
    });
}
// 旧 onPlayerCreate / onPlayerDelete は onPlayerCreated / onPlayerDeleted に統合
// Trigger on player update (e.g., lastSeen updates)
exports.onPlayerUpdate = functions.firestore
    .document("rooms/{roomId}/players/{playerId}")
    .onUpdate(async (change, ctx) => {
    const roomId = ctx.params.roomId;
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    // Only recalc when relevant fields change to reduce cost
    if (before.lastSeen?.toMillis?.() === after.lastSeen?.toMillis?.() &&
        before.lastActive === after.lastActive) {
        return;
    }
    try {
        await recalcRoomCounts(roomId);
    }
    catch (err) {
        console.error("Failed to refresh room statistics after player update", err);
    }
});
function isPresenceConnActive(conn, now) {
    if (!conn)
        return false;
    if (conn.online === false)
        return false;
    if (conn.online === true && typeof conn.ts !== "number")
        return true;
    const ts = typeof conn.ts === "number" ? conn.ts : 0;
    if (!ts)
        return false;
    if (ts - now > presence_1.MAX_CLOCK_SKEW_MS)
        return false;
    return now - ts <= PRESENCE_STALE_THRESHOLD_MS;
}
exports.onPresenceWrite = functions.database
    .ref("presence/{roomId}/{uid}/{connId}")
    .onWrite(async (change, ctx) => {
    if (EMERGENCY_STOP)
        return null;
    const { roomId, uid } = ctx.params;
    try {
        const after = change.after.val();
        const before = change.before.val();
        const now = Date.now();
        const afterActive = change.after.exists()
            ? isPresenceConnActive(after, now)
            : false;
        const beforeActive = change.before.exists()
            ? isPresenceConnActive(before, now)
            : false;
        if (afterActive) {
            // まだオンライン扱いなので何もしない
            return null;
        }
        // 変化がなく単純に stale な書き込みでなければスキップ
        const wentOffline = beforeActive && !afterActive;
        const removed = change.after.exists() === false && change.before.exists();
        const markedOffline = change.after.exists() && after?.online === false;
        if (!wentOffline && !removed && !markedOffline) {
            return null;
        }
        const dbi = admin.database();
        const userRef = dbi.ref(`presence/${roomId}/${uid}`);
        const snap = await userRef.get();
        const val = snap.val();
        const stillActive = val
            ? Object.values(val).some((conn) => isPresenceConnActive(conn, now))
            : false;
        if (stillActive) {
            return null;
        }
        // 完全に切断されたのでノードを掃除し、部屋から退室させる
        await userRef.remove().catch((err) => {
            console.warn("Failed to remove user from room presence", { roomId, uid, err });
        });
        try {
            const playerDoc = await db
                .collection("rooms")
                .doc(roomId)
                .collection("players")
                .doc(uid)
                .get();
            if (!playerDoc.exists) {
                return null;
            }
            logDebug("leaveRoomServer cleanup invoked", {
                roomId,
                uid,
                flags: { wentOffline, removed, markedOffline },
            });
            await (0, roomActions_1.leaveRoomServer)(roomId, uid, null);
            logDebug("leaveRoomServer cleanup succeeded", { roomId, uid });
        }
        catch (err) {
            console.error("leaveRoomServer cleanup failed", { roomId, uid, err });
        }
    }
    catch (err) {
        console.error("Presence write handler failed", { roomId, uid, err });
    }
    return null;
});
// 定期実行: expiresAt を過ぎた rooms を削除（players/chat も含めて）
exports.cleanupExpiredRooms = functions.pubsub
    .schedule("every 10 minutes")
    .onRun(async (context) => {
    if (EMERGENCY_STOP)
        return null;
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const q = db.collection("rooms").where("expiresAt", "<=", now).limit(50);
    const snap = await q.get();
    if (snap.empty)
        return null;
    // players/chat を削除した上で room を削除
    for (const docSnap of snap.docs) {
        const roomRef = docSnap.ref;
        const playersSnap = await roomRef.collection("players").listDocuments();
        // ベストプラクティス: 誰かが居る部屋は削除しない
        if (playersSnap.length > 0) {
            // 可能なら期限を延長/クリアして誤削除を避ける（任意）
            try {
                await roomRef.update({
                    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            catch { }
            continue;
        }
        const chatSnap = await roomRef.collection("chat").listDocuments();
        if (chatSnap.length) {
            const b = db.batch();
            for (const c of chatSnap)
                b.delete(c);
            await b.commit();
        }
        await roomRef.delete();
    }
    return null;
});
// 定期実行: 古いチャットの削除（14日以上前を削除）
exports.pruneOldChat = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async () => {
    if (EMERGENCY_STOP)
        return null;
    const db = admin.firestore();
    const roomsSnap = await db.collection("rooms").select().get();
    if (roomsSnap.empty)
        return null;
    const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));
    for (const room of roomsSnap.docs) {
        const chatCol = room.ref.collection("chat");
        const q = chatCol
            .where("createdAt", "<", cutoff)
            .orderBy("createdAt", "asc")
            .limit(500);
        const snap = await q.get();
        if (snap.empty)
            continue;
        const batch = db.batch();
        for (const d of snap.docs)
            batch.delete(d.ref);
        await batch.commit();
    }
    return null;
});
/**
 * Scheduled cleanup for "ghost rooms":
 * - No active RTDB presence AND
 * - No players with recent `lastSeen` AND
 * - Not in-progress (or in-progress but stale for long time)
 * Then delete players/chat and the room itself.
 */
exports.cleanupGhostRooms = functions.pubsub
    .schedule("every 15 minutes")
    .onRun(async () => {
    if (EMERGENCY_STOP)
        return null;
    const dbi = admin.firestore();
    const rtdb = admin.database();
    // Tunables
    const NOW = Date.now();
    const STALE_LASTSEEN_MS = Number(process.env.GHOST_STALE_LASTSEEN_MS) || 10 * 60 * 1000; // 10min
    const ROOM_MIN_AGE_MS = Number(process.env.GHOST_ROOM_MIN_AGE_MS) || 30 * 60 * 1000; // 30min
    const stalePresenceMs = PRESENCE_STALE_THRESHOLD_MS;
    // Process in small chunks to limit costs
    const roomsSnap = await dbi.collection("rooms").select().limit(100).get();
    if (roomsSnap.empty)
        return null;
    for (const roomDoc of roomsSnap.docs) {
        try {
            const roomId = roomDoc.id;
            const room = roomDoc.data();
            // Quick age gate: only consider sufficiently old rooms
            const lastActive = room?.lastActiveAt;
            const createdAt = room?.createdAt;
            const newerMs = Math.max(toMillis(lastActive), toMillis(createdAt));
            const ageMs = newerMs ? NOW - newerMs : Number.POSITIVE_INFINITY;
            if (ageMs < ROOM_MIN_AGE_MS)
                continue;
            // Skip actively playing rooms (clue/reveal), unless clearly stale
            const isInProgress = room?.status &&
                room.status !== "waiting" &&
                room.status !== "completed";
            // Presence count from RTDB
            let presenceCount = 0;
            try {
                const presSnap = await rtdb.ref(`presence/${roomId}`).get();
                if (presSnap.exists()) {
                    const val = presSnap.val();
                    const nowLocal = Date.now();
                    for (const uid of Object.keys(val)) {
                        const conns = val[uid] || {};
                        const online = Object.values(conns).some((c) => {
                            if (c?.online === false)
                                return false;
                            if (c?.online === true && typeof c?.ts !== "number")
                                return true;
                            const ts = typeof c?.ts === "number" ? c.ts : 0;
                            if (!ts)
                                return false;
                            if (ts - nowLocal > stalePresenceMs)
                                return false;
                            return nowLocal - ts <= stalePresenceMs;
                        });
                        if (online)
                            presenceCount++;
                    }
                }
            }
            catch { }
            if (presenceCount > 0)
                continue; // someone is online; skip
            // Count "recent" players by lastSeen
            const playersCol = roomDoc.ref.collection("players");
            const playersSnap = await playersCol.get();
            const nowTs = Date.now();
            let recentPlayers = 0;
            for (const d of playersSnap.docs) {
                const ls = d.data()?.lastSeen;
                const ms = toMillis(ls);
                if (ms && nowTs - ms <= STALE_LASTSEEN_MS)
                    recentPlayers++;
            }
            // If any recent players exist, keep the room
            if (recentPlayers > 0)
                continue;
            // At this point, no presence and players are stale. If still marked in-progress, relax to waiting.
            if (isInProgress) {
                try {
                    await roomDoc.ref.update({ status: "waiting" });
                }
                catch { }
            }
            // Delete chat docs first (best effort)
            try {
                const chatRefs = await roomDoc.ref.collection("chat").listDocuments();
                if (chatRefs.length) {
                    const batch = dbi.batch();
                    for (const c of chatRefs)
                        batch.delete(c);
                    await batch.commit();
                }
            }
            catch { }
            // Delete all players (best effort)
            try {
                const playerRefs = await roomDoc.ref
                    .collection("players")
                    .listDocuments();
                if (playerRefs.length) {
                    const batch = dbi.batch();
                    for (const p of playerRefs)
                        batch.delete(p);
                    await batch.commit();
                }
            }
            catch { }
            // Finally, delete the room itself
            try {
                await roomDoc.ref.delete();
            }
            catch { }
        }
        catch (err) {
            console.error("Failed to clean up ghost rooms", err);
        }
    }
    return null;
});
exports.presenceCleanup = functions.pubsub
    .schedule("every 1 minutes")
    .onRun(async () => {
    if (EMERGENCY_STOP)
        return null;
    if (!rtdb)
        return null;
    const now = Date.now();
    const maxRemovals = Math.max(200, Math.ceil(presence_1.PRESENCE_CLEANUP_INTERVAL_MS / 1000) * 10);
    const maxRooms = 200;
    const snapshot = await rtdb.ref("presence").get();
    if (!snapshot.exists())
        return null;
    let removed = 0;
    let visitedRooms = 0;
    const removals = [];
    snapshot.forEach((roomSnap) => {
        if (removed >= maxRemovals || visitedRooms >= maxRooms) {
            return true;
        }
        visitedRooms += 1;
        const roomId = roomSnap.key;
        if (!roomId)
            return undefined;
        const roomVal = roomSnap.val();
        Object.entries(roomVal || {}).forEach(([uid, conns]) => {
            if (removed >= maxRemovals)
                return;
            if (!conns || typeof conns !== "object")
                return;
            Object.entries(conns).forEach(([connId, payload]) => {
                if (removed >= maxRemovals)
                    return;
                if (isPresenceConnActive(payload, now))
                    return;
                removed += 1;
                removals.push(rtdb
                    .ref(`presence/${roomId}/${uid}/${connId}`)
                    .remove()
                    .catch((error) => console.warn("presenceCleanup remove failed", {
                    roomId,
                    uid,
                    connId,
                    error,
                })));
            });
        });
        return undefined;
    });
    if (removals.length > 0) {
        await Promise.all(removals);
        logDebug("presence", "cleanup-removed", {
            count: removals.length,
            visitedRooms,
        });
    }
    return null;
});
exports.pruneIdleRooms = functions.pubsub
    .schedule("every 5 minutes")
    .onRun(async () => {
    if (EMERGENCY_STOP)
        return null;
    const dbi = admin.firestore();
    const rt = admin.database ? admin.database() : null;
    const now = Date.now();
    const envThreshold = Number(process.env.IDLE_ROOM_THRESHOLD_MS);
    const idleThresholdMs = Number.isFinite(envThreshold) && envThreshold > 0
        ? envThreshold
        : 5 * 60 * 1000;
    const cutoffMs = now - idleThresholdMs;
    if (cutoffMs <= 0)
        return null;
    const cutoffTs = admin.firestore.Timestamp.fromMillis(cutoffMs);
    const roomQuery = await dbi
        .collection("rooms")
        .where("lastActiveAt", "<", cutoffTs)
        .limit(30)
        .get();
    if (roomQuery.empty) {
        return null;
    }
    let processedRooms = 0;
    let prunedPlayers = 0;
    for (const roomDoc of roomQuery.docs) {
        const roomId = roomDoc.id;
        const roomData = roomDoc.data();
        const playersCount = Number.isFinite(roomData?.playersCount)
            ? Math.max(0, Number(roomData.playersCount))
            : 0;
        if (!playersCount) {
            continue;
        }
        // Presence check
        let presenceActive = false;
        if (rt) {
            try {
                const presSnap = await rt.ref(`presence/${roomId}`).get();
                if (presSnap.exists()) {
                    const val = presSnap.val();
                    const nowLocal = Date.now();
                    presenceActive = Object.values(val || {}).some((connMap) => {
                        return Object.values(connMap || {}).some((conn) => isPresenceConnActive(conn, nowLocal));
                    });
                }
            }
            catch (err) {
                console.warn("Failed to check presence activity for room", { roomId, err });
            }
        }
        if (presenceActive) {
            continue;
        }
        // Skip if any player has been seen recently
        try {
            const recentSnap = await roomDoc.ref
                .collection("players")
                .where("lastSeen", ">=", cutoffTs)
                .limit(1)
                .get();
            if (!recentSnap.empty) {
                continue;
            }
        }
        catch (err) {
            console.warn("Failed to query recent players for room", { roomId, err });
            continue;
        }
        let playersSnap;
        try {
            playersSnap = await roomDoc.ref.collection("players").get();
        }
        catch (err) {
            console.warn("Failed to read players while pruning idle room", { roomId, err });
            continue;
        }
        if (playersSnap.empty) {
            continue;
        }
        const stalePlayerIds = [];
        let hasRecent = false;
        playersSnap.forEach((playerDoc) => {
            if (hasRecent)
                return;
            const data = playerDoc.data();
            const lastSeenMs = toMillis(data?.lastSeen);
            if (lastSeenMs && now - lastSeenMs < idleThresholdMs) {
                hasRecent = true;
                return;
            }
            stalePlayerIds.push(playerDoc.id);
        });
        if (hasRecent || stalePlayerIds.length === 0) {
            continue;
        }
        processedRooms += 1;
        const cappedIds = stalePlayerIds.slice(0, 10);
        for (const playerId of cappedIds) {
            try {
                await (0, roomActions_1.leaveRoomServer)(roomId, playerId, null);
                prunedPlayers += 1;
            }
            catch (err) {
                console.error("Failed to remove idle player during prune", {
                    roomId,
                    playerId,
                    err,
                });
            }
        }
    }
    if (processedRooms || prunedPlayers) {
        logDebug("Idle room prune summary", {
            processedRooms,
            prunedPlayers,
            thresholdMs: idleThresholdMs,
        });
    }
    return null;
});
// ルームが新ラウンド（status: clue に遷移し round が増加）になったら、その部屋のチャットをクリア
exports.purgeChatOnRoundStart = functions.firestore
    .document("rooms/{roomId}")
    .onUpdate(async (change, ctx) => {
    if (EMERGENCY_STOP)
        return null;
    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after)
        return null;
    const beforeRound = typeof before.round === "number" ? before.round : 0;
    const afterRound = typeof after.round === "number" ? after.round : 0;
    const statusChangedToClue = after.status === "clue" && before.status !== "clue";
    const roundIncreased = afterRound > beforeRound;
    if (!(statusChangedToClue || roundIncreased))
        return null;
    try {
        const dbi = admin.firestore();
        const roomRef = dbi.collection("rooms").doc(ctx.params.roomId);
        const chatRefs = await roomRef.collection("chat").listDocuments();
        if (chatRefs.length === 0)
            return null;
        const batch = dbi.batch();
        for (const d of chatRefs)
            batch.delete(d);
        await batch.commit();
    }
    catch { }
    return null;
});
// players ドキュメント削除時: lastActiveAt を更新し、最後の1人が抜けた場合はルームを初期化＋クローズ
exports.onPlayerDeleted = functions.firestore
    .document("rooms/{roomId}/players/{playerId}")
    .onDelete(async (snap, ctx) => {
    if (EMERGENCY_STOP)
        return null;
    const dbi = admin.firestore();
    const roomRef = dbi.collection("rooms").doc(ctx.params.roomId);
    // lastActiveAt を更新
    try {
        await roomRef.update({
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch { }
    try {
        const players = await roomRef.collection("players").limit(1).get();
        if (players.empty) {
            // 最後の1人が抜けた → ルームを初期化し、クローズ＋有効期限を設定
            const expires = new Date(Date.now() + 3 * 60 * 1000); // 3分
            await roomRef.update({
                status: "waiting",
                result: null,
                deal: null,
                order: null,
                round: 0,
                topic: null,
                topicOptions: null,
                topicBox: null,
                closedAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromDate(expires),
                lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else {
            // ホストが消えた場合のフォールバック: 先頭の参加者をホストに
            const roomSnap = await roomRef.get();
            const room = roomSnap.data() || {};
            const hostId = room.hostId;
            if (!hostId) {
                const next = await roomRef.collection("players").limit(1).get();
                const nextId = next.empty ? null : next.docs[0].id;
                if (nextId) {
                    console.warn("Promoted next player to host after host left", {
                        roomId: ctx.params.roomId,
                        nextId,
                    });
                    await roomRef.update({ hostId: nextId });
                }
            }
        }
    }
    catch { }
    try {
        await recalcRoomCounts(ctx.params.roomId);
    }
    catch (err) {
        console.error("Failed to recalculate room counts after player deletion", err);
    }
    return null;
});
// 定期実行: オーファン（無人）ルームの削除（最終活動が24h以上前かつplayers=0）
exports.purgeOrphanRooms = functions.pubsub
    .schedule("every 60 minutes")
    .onRun(async () => {
    if (EMERGENCY_STOP)
        return null;
    const dbi = admin.firestore();
    const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const q = dbi
        .collection("rooms")
        .where("lastActiveAt", "<", cutoff)
        .limit(50);
    const snap = await q.get();
    for (const docSnap of snap.docs) {
        const roomRef = docSnap.ref;
        const players = await roomRef.collection("players").limit(1).get();
        if (!players.empty)
            continue; // 誰かいるなら残す
        await roomRef.delete();
    }
    return null;
});
// 参加者作成時: ルームをアクティブ扱いに（expiresAt解除 + lastActiveAt更新）
exports.onPlayerCreated = functions.firestore
    .document("rooms/{roomId}/players/{playerId}")
    .onCreate(async (_snap, ctx) => {
    if (EMERGENCY_STOP)
        return null;
    try {
        const dbi = admin.firestore();
        const roomRef = dbi.collection("rooms").doc(ctx.params.roomId);
        await roomRef.update({
            expiresAt: null,
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await recalcRoomCounts(ctx.params.roomId);
        try {
            const data = _snap.data();
            const rawName = typeof data?.name === "string" ? data.name : null;
            const rawUid = typeof data?.uid === "string" ? data.uid : null;
            const normalizedUid = rawUid ? rawUid.trim() : "";
            if (!normalizedUid || _snap.id !== normalizedUid) {
                return null;
            }
            await roomRef.collection("chat").add({
                sender: "system",
                uid: "system",
                text: (0, systemMessages_1.systemMessagePlayerJoined)(rawName),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        catch (err) {
            console.warn("Could not send system join message", {
                roomId: ctx.params.roomId,
                playerId: ctx.params.playerId,
                err,
            });
        }
    }
    catch { }
    return null;
});
// 定期実行: 古い events の削除（右上トースト用イベントの整理）
// 既定で 7 日より古いものを削除（環境変数 EVENT_RETENTION_DAYS で日数変更可能）
exports.pruneOldEvents = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async () => {
    if (EMERGENCY_STOP)
        return null;
    const dbi = admin.firestore();
    const days = Number(process.env.EVENT_RETENTION_DAYS || 7);
    const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
    // ルームを分割して処理（コスト抑制のため上限あり）
    const roomsSnap = await dbi.collection("rooms").select().limit(100).get();
    if (roomsSnap.empty)
        return null;
    for (const room of roomsSnap.docs) {
        try {
            const eventsCol = room.ref.collection("events");
            // 期間外を削除
            const snap = await eventsCol
                .where("createdAt", "<", cutoff)
                .orderBy("createdAt", "asc")
                .limit(500)
                .get();
            if (snap.empty)
                continue;
            const batch = dbi.batch();
            for (const d of snap.docs)
                batch.delete(d.ref);
            await batch.commit();
        }
        catch (err) {
            console.error("Failed to prune old events", { roomId: room.id, err });
        }
    }
    return null;
});
var rejoin_1 = require("./rejoin");
Object.defineProperty(exports, "onRejoinRequestCreate", { enumerable: true, get: function () { return rejoin_1.onRejoinRequestCreate; } });
Object.defineProperty(exports, "onRoomWaitingProcessRejoins", { enumerable: true, get: function () { return rejoin_1.onRoomWaitingProcessRejoins; } });
