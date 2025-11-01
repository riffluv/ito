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
exports.onRoomWaitingProcessRejoins = exports.onRejoinRequestUpdate = exports.onRejoinRequestCreate = void 0;
const utils_1 = require("@/lib/utils");
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const db = admin.firestore();
const ACCEPT_MAX_ATTEMPTS = 3;
const ACCEPT_BACKOFF_MS = [0, 200, 800];
const logger = functions.logger ?? console;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function normalizeName(name) {
    if (typeof name !== "string")
        return "名無し";
    const trimmed = name.trim();
    return trimmed.length > 0 ? trimmed : "名無し";
}
async function acceptPendingRequest(roomId, uid) {
    const requestRef = db
        .collection("rooms")
        .doc(roomId)
        .collection("rejoinRequests")
        .doc(uid);
    let outcome = "missing";
    let desiredName = null;
    await db.runTransaction(async (tx) => {
        const requestSnap = await tx.get(requestRef);
        if (!requestSnap.exists) {
            outcome = "missing";
            return;
        }
        const request = requestSnap.data();
        const status = request.status ?? "pending";
        desiredName = normalizeName(request.displayName);
        if (status === "accepted") {
            outcome = "already";
            return;
        }
        if (status === "rejected") {
            outcome = "rejected";
            return;
        }
        const serverTs = admin.firestore.FieldValue.serverTimestamp();
        tx.update(requestRef, {
            status: "accepted",
            acceptedAt: serverTs,
        });
        outcome = "accepted";
    });
    return { outcome, desiredName };
}
async function handleRejoinRequest(roomId, uid, trigger) {
    const requestRef = db
        .collection("rooms")
        .doc(roomId)
        .collection("rejoinRequests")
        .doc(uid);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
        return "missing";
    }
    const data = requestSnap.data();
    const status = data.status ?? "pending";
    if (status === "accepted") {
        return "already";
    }
    if (status === "rejected") {
        return "rejected";
    }
    let lastError = null;
    for (let attempt = 0; attempt < ACCEPT_MAX_ATTEMPTS; attempt += 1) {
        try {
            const { outcome, desiredName } = await acceptPendingRequest(roomId, uid);
            if (outcome === "accepted" || outcome === "already") {
                if (outcome === "accepted") {
                    try {
                        await finalizeAcceptedRequest(roomId, uid, desiredName);
                    }
                    catch (finalizeError) {
                        logger.error("rejoin.finalize.error", {
                            roomId,
                            uid,
                            trigger,
                            error: finalizeError,
                        });
                    }
                }
                return outcome;
            }
            if (outcome === "missing" || outcome === "rejected") {
                return outcome;
            }
            if (outcome === "pending") {
                return "pending";
            }
        }
        catch (error) {
            lastError = error;
            logger.error("rejoin.accept.error", {
                roomId,
                uid,
                attempt,
                trigger,
                error,
            });
        }
        const delay = ACCEPT_BACKOFF_MS[Math.min(attempt + 1, ACCEPT_BACKOFF_MS.length - 1)];
        if (delay > 0) {
            await sleep(delay);
        }
    }
    const failureReason = lastError instanceof Error
        ? lastError.message
        : lastError
            ? String(lastError)
            : "unknown";
    await requestRef.update({
        status: "rejected",
        rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
        failureReason,
    });
    logger.error("rejoin.accept.gaveup", { roomId, uid, trigger, failureReason });
    return "rejected";
}
async function finalizeAcceptedRequest(roomId, uid, desiredName) {
    const roomRef = db.collection("rooms").doc(roomId);
    const playerRef = roomRef.collection("players").doc(uid);
    const normalizedName = normalizeName(desiredName);
    const serverTs = admin.firestore.FieldValue.serverTimestamp();
    await db.runTransaction(async (tx) => {
        const roomSnap = await tx.get(roomRef);
        if (!roomSnap.exists) {
            return;
        }
        const roomData = roomSnap.data();
        const playerSnap = await tx.get(playerRef);
        if (!playerSnap.exists) {
            const playersSnap = await tx.get(roomRef.collection("players"));
            const usedAvatars = new Set();
            playersSnap.forEach((doc) => {
                const avatar = doc.get("avatar");
                if (typeof avatar === "string") {
                    usedAvatars.add(avatar);
                }
            });
            const fallbackAvatar = (0, utils_1.getAvatarByOrder)(playersSnap.size);
            const avatar = utils_1.AVATAR_LIST.find((item) => !usedAvatars.has(item)) ?? fallbackAvatar;
            tx.set(playerRef, {
                name: normalizedName,
                avatar,
                number: null,
                clue1: "",
                ready: false,
                orderIndex: 0,
                uid,
                lastSeen: serverTs,
                joinedAt: serverTs,
            });
        }
        else {
            const updates = {
                lastSeen: serverTs,
            };
            if (!playerSnap.get("uid")) {
                updates.uid = uid;
            }
            if (!playerSnap.get("joinedAt")) {
                updates.joinedAt = serverTs;
            }
            if (playerSnap.get("name") !== normalizedName) {
                updates.name = normalizedName;
            }
            if (Object.keys(updates).length > 0) {
                tx.update(playerRef, updates);
            }
        }
        const roomUpdates = {
            lastActiveAt: serverTs,
        };
        const currentDeal = roomData?.deal;
        let totalPlayers = null;
        if (currentDeal) {
            const currentPlayers = Array.isArray(currentDeal.players)
                ? currentDeal.players.filter((playerId) => typeof playerId === "string" && playerId.length > 0)
                : [];
            const seatHistorySource = currentDeal.seatHistory;
            const seatHistory = seatHistorySource && typeof seatHistorySource === "object"
                ? { ...seatHistorySource }
                : {};
            let targetIndex = null;
            const recordedIndex = seatHistory[uid];
            if (typeof recordedIndex === "number" && recordedIndex >= 0) {
                targetIndex = recordedIndex;
            }
            if (targetIndex === null) {
                const existingIndex = currentPlayers.indexOf(uid);
                if (existingIndex >= 0) {
                    targetIndex = existingIndex;
                }
            }
            let nextPlayers = currentPlayers.filter((playerId) => playerId !== uid);
            if (targetIndex === null || targetIndex < 0 || targetIndex > nextPlayers.length) {
                targetIndex = nextPlayers.length;
            }
            nextPlayers.splice(targetIndex, 0, uid);
            const nextSeatHistory = { ...seatHistory };
            nextPlayers.forEach((playerId, index) => {
                nextSeatHistory[playerId] = index;
            });
            roomUpdates["deal.players"] = nextPlayers;
            roomUpdates["deal.seatHistory"] = nextSeatHistory;
            totalPlayers = nextPlayers.length;
        }
        if (totalPlayers !== null && roomData?.order) {
            roomUpdates["order.total"] = totalPlayers;
        }
        tx.update(roomRef, roomUpdates);
    });
}
exports.onRejoinRequestCreate = functions.firestore
    .document("rooms/{roomId}/rejoinRequests/{uid}")
    .onCreate(async (_snap, context) => {
    const roomId = context.params.roomId;
    const uid = context.params.uid;
    const result = await handleRejoinRequest(roomId, uid, "create");
    logger.debug("rejoin.onCreate.result", { roomId, uid, result });
});
exports.onRejoinRequestUpdate = functions.firestore
    .document("rooms/{roomId}/rejoinRequests/{uid}")
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!after) {
        return;
    }
    const prevStatus = before?.status ?? "pending";
    const nextStatus = after.status ?? "pending";
    if (nextStatus !== "pending") {
        return;
    }
    if (prevStatus === "pending") {
        return;
    }
    const roomId = context.params.roomId;
    const uid = context.params.uid;
    const result = await handleRejoinRequest(roomId, uid, "update");
    logger.debug("rejoin.onUpdate.result", { roomId, uid, result, prevStatus });
});
exports.onRoomWaitingProcessRejoins = functions.firestore
    .document("rooms/{roomId}")
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after) {
        return;
    }
    if (before.status === "waiting") {
        return;
    }
    if (after.status !== "waiting") {
        return;
    }
    const roomId = context.params.roomId;
    const requestsSnapshot = await change.after.ref
        .collection("rejoinRequests")
        .where("status", "==", "pending")
        .get();
    if (requestsSnapshot.empty) {
        return;
    }
    for (const doc of requestsSnapshot.docs) {
        const uid = doc.id;
        try {
            const result = await handleRejoinRequest(roomId, uid, "roomWaiting");
            logger.debug("rejoin.onWaiting.result", { roomId, uid, result });
        }
        catch (error) {
            logger.error("rejoin.onWaiting.error", { roomId, uid, error });
        }
    }
});
