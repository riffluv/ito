"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureHostAssignedServer = ensureHostAssignedServer;
exports.leaveRoomServer = leaveRoomServer;
exports.transferHostServer = transferHostServer;
const firestore_1 = require("firebase-admin/firestore");
const firebaseAdmin_1 = require("@/lib/server/firebaseAdmin");
const log_1 = require("@/lib/utils/log");
const HostManager_1 = require("@/lib/host/HostManager");
const systemMessages_1 = require("@/lib/server/systemMessages");
const PRESENCE_STALE_MS = Number(process.env.NEXT_PUBLIC_PRESENCE_STALE_MS ||
    process.env.PRESENCE_STALE_MS ||
    300000);
const MAX_CLOCK_SKEW_MS = Number(process.env.NEXT_PUBLIC_PRESENCE_MAX_CLOCK_SKEW_MS ||
    process.env.PRESENCE_MAX_CLOCK_SKEW_MS ||
    120000);
function sanitizeServerText(input, maxLength = 500) {
    if (typeof input !== "string")
        return "";
    // eslint-disable-next-line no-control-regex -- 制御文字を明示的に除去するためのパターン
    const controlCharsPattern = /[\u0000-\u001F\u007F]/g;
    const normalized = input
        .replace(controlCharsPattern, " ")
        .replace(/[<>]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    return normalized.slice(0, Math.max(maxLength, 0));
}
function isConnectionActive(conn, now) {
    if (conn?.online === false)
        return false;
    if (conn?.online === true && typeof conn?.ts !== "number")
        return true;
    const ts = typeof conn?.ts === "number" ? conn.ts : 0;
    if (!ts)
        return false;
    if (ts - now > MAX_CLOCK_SKEW_MS)
        return false;
    return now - ts <= PRESENCE_STALE_MS;
}
async function fetchPresenceUids(roomId, db) {
    try {
        const snap = await db.ref(`presence/${roomId}`).get();
        const val = (snap.val() || {});
        const now = Date.now();
        return Object.keys(val).filter((uid) => {
            const conns = val[uid] || {};
            return Object.values(conns).some((c) => isConnectionActive(c, now));
        });
    }
    catch {
        return [];
    }
}
async function forceDetachAll(roomId, uid, db) {
    if (!db)
        return;
    try {
        const baseRef = db.ref(`presence/${roomId}/${uid}`);
        const snap = await baseRef.get();
        const val = snap.val();
        if (!val)
            return;
        await Promise.all(Object.keys(val).map((connId) => baseRef
            .child(connId)
            .remove()
            .catch(() => void 0)));
        await baseRef.remove().catch(() => void 0);
    }
    catch { }
}
async function sendSystemMessage(roomId, text) {
    const clean = sanitizeServerText(text);
    if (!clean)
        return;
    const db = (0, firebaseAdmin_1.getAdminDb)();
    await db
        .collection("rooms")
        .doc(roomId)
        .collection("chat")
        .add({
        sender: "system",
        uid: "system",
        text: clean,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    })
        .catch(() => void 0);
}
const LEAVE_DEDUPE_WINDOW_MS = 4000;
const LEAVE_DEDUPE_PRUNE_MS = 60000;
async function resetRoomToWaiting(roomId) {
    const db = (0, firebaseAdmin_1.getAdminDb)();
    const roomRef = db.collection("rooms").doc(roomId);
    const snap = await roomRef.get();
    if (!snap.exists)
        return;
    await roomRef
        .update({
        status: "waiting",
        result: null,
        deal: null,
        order: null,
        round: 0,
        topic: null,
        topicOptions: null,
        topicBox: null,
        closedAt: null,
        expiresAt: null,
    })
        .catch(() => void 0);
    try {
        const playersSnap = await roomRef.collection("players").get();
        if (playersSnap.empty)
            return;
        const batch = db.batch();
        playersSnap.forEach((doc) => {
            batch.update(doc.ref, {
                number: null,
                clue1: "",
                ready: false,
                orderIndex: 0,
            });
        });
        await batch.commit();
    }
    catch (error) {
        (0, log_1.logWarn)("rooms", "reset-room-server-failed", error);
    }
}
async function getPlayerName(roomId, playerId) {
    try {
        const snap = await (0, firebaseAdmin_1.getAdminDb)()
            .collection("rooms")
            .doc(roomId)
            .collection("players")
            .doc(playerId)
            .get();
        const name = snap.data()?.name;
        if (typeof name === "string" && name.trim())
            return name.trim();
    }
    catch { }
    return playerId;
}
async function ensureHostAssignedServer(roomId, uid) {
    const db = (0, firebaseAdmin_1.getAdminDb)();
    const roomRef = db.collection("rooms").doc(roomId);
    await db.runTransaction(async (tx) => {
        const roomSnap = await tx.get(roomRef);
        if (!roomSnap.exists)
            return;
        const room = roomSnap.data();
        const currentHost = typeof room?.hostId === "string" && room.hostId.trim() ? room.hostId.trim() : null;
        const existingCreatorId = typeof room?.creatorId === "string" && room.creatorId.trim() ? room.creatorId.trim() : null;
        const existingCreatorName = typeof room?.creatorName === "string" && room.creatorName.trim() ? room.creatorName.trim() : null;
        const baseUpdates = {};
        if (!existingCreatorId && currentHost) {
            baseUpdates.creatorId = currentHost;
            if (typeof room?.hostName === "string" && room.hostName.trim()) {
                baseUpdates.creatorName = room.hostName.trim();
            }
            else if (existingCreatorName === null) {
                baseUpdates.creatorName = firestore_1.FieldValue.delete();
            }
        }
        const playersRef = roomRef.collection("players");
        const playersSnap = await tx.get(playersRef);
        if (playersSnap.empty)
            return;
        const playerDocs = playersSnap.docs;
        const normalizedHostId = currentHost ? currentHost : null;
        if (normalizedHostId && normalizedHostId !== uid) {
            const hostStillRegistered = playerDocs.some((doc) => {
                if (doc.id === normalizedHostId)
                    return true;
                const data = doc.data();
                return typeof data?.uid === "string" && data.uid === normalizedHostId;
            });
            if (hostStillRegistered) {
                if (Object.keys(baseUpdates).length > 0) {
                    tx.update(roomRef, baseUpdates);
                }
                return;
            }
        }
        const meDoc = playerDocs.find((doc) => doc.id === uid) ||
            playerDocs.find((doc) => {
                const data = doc.data();
                return typeof data?.uid === "string" && data.uid === uid;
            });
        if (!meDoc)
            return;
        const canonicalDocs = playerDocs.filter((doc) => {
            if (doc.id === meDoc.id)
                return true;
            const data = doc.data();
            const sameUid = typeof data?.uid === "string" && data.uid === uid;
            if (sameUid || doc.id === uid) {
                tx.delete(doc.ref);
                return false;
            }
            return true;
        });
        const rtdb = (0, firebaseAdmin_1.getAdminRtdb)();
        const onlineSet = new Set();
        onlineSet.add(meDoc.id);
        if (meDoc.id !== uid)
            onlineSet.add(uid);
        if (rtdb) {
            try {
                const online = await fetchPresenceUids(roomId, rtdb);
                for (const onlineUid of online) {
                    onlineSet.add(onlineUid);
                }
            }
            catch { }
        }
        const playerInputs = (0, HostManager_1.buildHostPlayerInputsFromSnapshots)({
            docs: canonicalDocs,
            getJoinedAt: (doc) => (doc.createTime ? doc.createTime.toMillis() : null),
            getOrderIndex: (doc) => {
                const data = doc.data();
                return typeof data?.orderIndex === "number" ? data.orderIndex : null;
            },
            getLastSeenAt: (doc) => {
                const data = doc.data();
                const raw = data?.lastSeen;
                if (raw && typeof raw.toMillis === "function") {
                    try {
                        return raw.toMillis();
                    }
                    catch {
                        return null;
                    }
                }
                return null;
            },
            getName: (doc) => {
                const data = doc.data();
                return typeof data?.name === "string" ? data.name : null;
            },
            onlineIds: onlineSet,
        });
        const manager = new HostManager_1.HostManager({
            roomId,
            currentHostId: currentHost,
            players: playerInputs,
        });
        const decision = manager.evaluateClaim(uid);
        if (decision.action !== "assign") {
            if (Object.keys(baseUpdates).length > 0) {
                tx.update(roomRef, baseUpdates);
            }
            return;
        }
        const updates = { ...baseUpdates, hostId: decision.hostId };
        const meta = manager.getPlayerMeta(decision.hostId);
        const trimmedName = meta?.name && typeof meta.name === "string" ? meta.name.trim() : "";
        if (trimmedName) {
            updates.hostName = trimmedName;
        }
        else {
            updates.hostName = firestore_1.FieldValue.delete();
        }
        tx.update(roomRef, updates);
        (0, log_1.logDebug)("rooms", "host-claim assigned-server", {
            roomId,
            uid,
            hostId: decision.hostId,
            reason: decision.reason,
        });
    });
}
async function leaveRoomServer(roomId, userId, displayName) {
    const db = (0, firebaseAdmin_1.getAdminDb)();
    const rtdb = (0, firebaseAdmin_1.getAdminRtdb)();
    await forceDetachAll(roomId, userId, rtdb);
    const playersRef = db.collection("rooms").doc(roomId).collection("players");
    let recordedPlayerName = null;
    let hadPlayerSnapshot = false;
    try {
        const primarySnap = await playersRef.doc(userId).get();
        const duplicatesSnap = await playersRef.where("uid", "==", userId).get();
        const seenIds = new Set();
        const batch = db.batch();
        const pushDoc = (doc) => {
            if (seenIds.has(doc.id))
                return;
            seenIds.add(doc.id);
            const value = doc.data()?.name;
            if (!recordedPlayerName && typeof value === "string" && value.trim()) {
                recordedPlayerName = value.trim();
            }
            batch.delete(doc.ref);
        };
        if (primarySnap.exists) {
            hadPlayerSnapshot = true;
            pushDoc(primarySnap);
        }
        duplicatesSnap.forEach((doc) => {
            hadPlayerSnapshot = true;
            pushDoc(doc);
        });
        if (!seenIds.has(userId)) {
            batch.delete(playersRef.doc(userId));
        }
        await batch.commit();
    }
    catch { }
    const presenceIds = new Set();
    if (rtdb) {
        try {
            const currentOnline = await fetchPresenceUids(roomId, rtdb);
            for (const onlineUid of currentOnline) {
                if (typeof onlineUid !== "string")
                    continue;
                const trimmed = onlineUid.trim();
                if (trimmed && trimmed !== userId) {
                    presenceIds.add(trimmed);
                }
            }
        }
        catch { }
    }
    let transferredTo = null;
    let transferredToName = null;
    let hostCleared = false;
    let remainingCount = 0;
    try {
        const roomRef = db.collection("rooms").doc(roomId);
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(roomRef);
            if (!snap.exists)
                return;
            const room = snap.data();
            const currentHostId = typeof room?.hostId === "string" && room.hostId.trim()
                ? room.hostId.trim()
                : null;
            const playersSnap = await tx.get(roomRef.collection("players"));
            const playerDocs = playersSnap.docs;
            remainingCount = playerDocs.length;
            const origPlayers = Array.isArray(room?.deal?.players)
                ? [...room.deal.players]
                : [];
            const filteredPlayers = origPlayers.filter((id) => id !== userId);
            const origList = Array.isArray(room?.order?.list)
                ? [...room.order.list]
                : [];
            const filteredList = origList.filter((id) => id !== userId);
            const origProposal = Array.isArray(room?.order?.proposal)
                ? [...room.order.proposal]
                : [];
            const filteredProposal = origProposal.filter((id) => id !== userId);
            const updates = {};
            if (origPlayers.length !== filteredPlayers.length) {
                updates["deal.players"] = filteredPlayers;
                updates["order.total"] = filteredPlayers.length;
            }
            if (origList.length !== filteredList.length) {
                updates["order.list"] = filteredList;
            }
            if (origProposal.length !== filteredProposal.length) {
                updates["order.proposal"] = filteredProposal;
            }
            const playerInputs = (0, HostManager_1.buildHostPlayerInputsFromSnapshots)({
                docs: playerDocs,
                getJoinedAt: (doc) => (doc.createTime ? doc.createTime.toMillis() : null),
                getOrderIndex: (doc) => {
                    const data = doc.data();
                    return typeof data?.orderIndex === "number" ? data.orderIndex : null;
                },
                getLastSeenAt: (doc) => {
                    const data = doc.data();
                    const raw = data?.lastSeen;
                    if (raw && typeof raw.toMillis === "function") {
                        try {
                            return raw.toMillis();
                        }
                        catch {
                            return null;
                        }
                    }
                    return null;
                },
                getName: (doc) => {
                    const data = doc.data();
                    return typeof data?.name === "string" ? data.name : null;
                },
                onlineIds: presenceIds,
            });
            const hostLeaving = currentHostId ? currentHostId === userId : false;
            const hostStillRegistered = currentHostId
                ? playerDocs.some((doc) => doc.id === currentHostId)
                : false;
            if (!hostLeaving && hostStillRegistered) {
                if (Object.keys(updates).length > 0) {
                    tx.update(roomRef, updates);
                }
                return;
            }
            const manager = new HostManager_1.HostManager({
                roomId,
                currentHostId,
                players: playerInputs,
                leavingUid: userId,
            });
            const decision = manager.evaluateAfterLeave();
            if (decision.action === "assign") {
                transferredTo = decision.hostId;
                const meta = manager.getPlayerMeta(decision.hostId);
                const trimmedName = meta?.name && typeof meta.name === "string" ? meta.name.trim() : "";
                transferredToName = trimmedName || null;
                updates.hostId = decision.hostId;
                updates.hostName = trimmedName ? trimmedName : firestore_1.FieldValue.delete();
            }
            else if (decision.action === "clear") {
                updates.hostId = "";
                updates.hostName = firestore_1.FieldValue.delete();
                hostCleared = true;
            }
            if (Object.keys(updates).length > 0) {
                tx.update(roomRef, updates);
            }
        });
    }
    catch (error) {
        (0, log_1.logWarn)("rooms", "leave-room-server-transaction-failed", error);
    }
    const resolvedDisplayName = (0, systemMessages_1.resolveSystemPlayerName)(displayName) ??
        (0, systemMessages_1.resolveSystemPlayerName)(recordedPlayerName);
    let skipNotification = false;
    try {
        const db = (0, firebaseAdmin_1.getAdminDb)();
        const dedupeRef = db
            .collection("rooms")
            .doc(roomId)
            .collection("meta")
            .doc("leaveDedup");
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(dedupeRef);
            const now = Date.now();
            const data = snap.data() || {};
            const rawEntries = data && typeof data.entries === "object" && data.entries
                ? data.entries
                : {};
            const entries = {};
            for (const key of Object.keys(rawEntries)) {
                const ts = rawEntries[key];
                if (typeof ts === "number" && now - ts <= LEAVE_DEDUPE_PRUNE_MS) {
                    entries[key] = ts;
                }
            }
            const lastTs = entries?.[userId];
            if (typeof lastTs === "number" && now - lastTs < LEAVE_DEDUPE_WINDOW_MS) {
                skipNotification = true;
            }
            entries[userId] = now;
            tx.set(dedupeRef, { entries }, { merge: true });
        });
    }
    catch (error) {
        (0, log_1.logWarn)("rooms", "leave-room-dedupe-failed", error);
    }
    if (skipNotification) {
        (0, log_1.logDebug)("rooms", "leave-room-skip-duplicate-window", {
            roomId,
            userId,
        });
    }
    else if (!resolvedDisplayName && !hadPlayerSnapshot) {
        (0, log_1.logDebug)("rooms", "leave-room-skip-duplicate", {
            roomId,
            userId,
        });
    }
    else {
        await sendSystemMessage(roomId, (0, systemMessages_1.systemMessagePlayerLeft)(resolvedDisplayName));
    }
    if (transferredTo) {
        try {
            const nextHostName = transferredToName || (await getPlayerName(roomId, transferredTo));
            await sendSystemMessage(roomId, (0, systemMessages_1.systemMessageHostTransferred)(nextHostName));
        }
        catch { }
        (0, log_1.logDebug)("rooms", "host-leave transferred-direct", {
            roomId,
            leavingUid: userId,
            transferredTo,
        });
        return;
    }
    if (hostCleared && remainingCount === 0) {
        try {
            await resetRoomToWaiting(roomId);
            (0, log_1.logDebug)("rooms", "host-leave fallback-reset", {
                roomId,
                leavingUid: userId,
            });
        }
        catch (error) {
            (0, log_1.logWarn)("rooms", "leave-room-server-reset-failed", error);
        }
    }
}
async function transferHostServer(roomId, currentUid, targetUid, opts = {}) {
    const db = (0, firebaseAdmin_1.getAdminDb)();
    let targetName = null;
    await db.runTransaction(async (tx) => {
        const roomRef = db.collection("rooms").doc(roomId);
        const roomSnap = await tx.get(roomRef);
        if (!roomSnap.exists) {
            throw new Error("room-not-found");
        }
        const room = roomSnap.data();
        const currentHostId = typeof room?.hostId === "string" ? room.hostId.trim() : "";
        if (!opts.isAdmin && (!currentHostId || currentHostId !== currentUid)) {
            throw new Error("not-host");
        }
        const targetRef = roomRef.collection("players").doc(targetUid);
        const targetSnap = await tx.get(targetRef);
        if (!targetSnap.exists) {
            throw new Error("target-not-found");
        }
        const targetData = targetSnap.data();
        const rawName = typeof targetData?.name === "string" ? targetData.name : null;
        const trimmed = rawName && rawName.trim().length > 0 ? rawName.trim() : "";
        targetName = rawName;
        tx.update(roomRef, {
            hostId: targetUid,
            hostName: trimmed ? trimmed : firestore_1.FieldValue.delete(),
        });
    });
    await sendSystemMessage(roomId, (0, systemMessages_1.systemMessageHostTransferred)((0, systemMessages_1.resolveSystemPlayerName)(targetName)));
}
