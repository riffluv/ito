import { AVATAR_LIST, getAvatarByOrder } from "@/lib/utils";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const db = admin.firestore();

type RejoinRequestStatus = "pending" | "accepted" | "rejected";
type RejoinRequestDoc = {
  displayName?: string | null;
  status?: RejoinRequestStatus;
  source?: "manual" | "auto";
  createdAt?: FirebaseFirestore.Timestamp;
  acceptedAt?: FirebaseFirestore.Timestamp;
  rejectedAt?: FirebaseFirestore.Timestamp;
  failureReason?: string | null;
};

type AcceptOutcome =
  | "accepted"
  | "already"
  | "rejected"
  | "pending"
  | "missing";

type RejoinTrigger = "create" | "update" | "roomWaiting";

const ACCEPT_MAX_ATTEMPTS = 3;
const ACCEPT_BACKOFF_MS = [0, 200, 800];

const logger = functions.logger ?? console;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeName(name: unknown): string {
  if (typeof name !== "string") return "名無し";
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : "名無し";
}

async function acceptPendingRequest(
  roomId: string,
  uid: string
): Promise<{ outcome: AcceptOutcome; desiredName: string | null }> {
  const requestRef = db
    .collection("rooms")
    .doc(roomId)
    .collection("rejoinRequests")
    .doc(uid);

  let outcome: AcceptOutcome = "missing";
  let desiredName: string | null = null;

  await db.runTransaction(async (tx) => {
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists) {
      outcome = "missing";
      return;
    }

    const request = requestSnap.data() as RejoinRequestDoc;
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

async function handleRejoinRequest(
  roomId: string,
  uid: string,
  trigger: RejoinTrigger
): Promise<AcceptOutcome> {
  const requestRef = db
    .collection("rooms")
    .doc(roomId)
    .collection("rejoinRequests")
    .doc(uid);
  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) {
    return "missing";
  }
  const data = requestSnap.data() as RejoinRequestDoc;
  const status = data.status ?? "pending";
  if (status === "accepted") {
    return "already";
  }
  if (status === "rejected") {
    return "rejected";
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt < ACCEPT_MAX_ATTEMPTS; attempt += 1) {
    try {
      const { outcome, desiredName } = await acceptPendingRequest(roomId, uid);
      if (outcome === "accepted" || outcome === "already") {
        if (outcome === "accepted") {
          try {
            await finalizeAcceptedRequest(roomId, uid, desiredName);
          } catch (finalizeError) {
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
    } catch (error) {
      lastError = error;
      logger.error("rejoin.accept.error", {
        roomId,
        uid,
        attempt,
        trigger,
        error,
      });
    }
    const delay =
      ACCEPT_BACKOFF_MS[Math.min(attempt + 1, ACCEPT_BACKOFF_MS.length - 1)];
    if (delay > 0) {
      await sleep(delay);
    }
  }

  const failureReason =
    lastError instanceof Error
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


async function finalizeAcceptedRequest(
  roomId: string,
  uid: string,
  desiredName: string | null
) {
  const roomRef = db.collection("rooms").doc(roomId);
  const playerRef = roomRef.collection("players").doc(uid);
  const normalizedName = normalizeName(desiredName);
  const serverTs = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists) {
      return;
    }
    const roomData = roomSnap.data() as FirebaseFirestore.DocumentData;

    const playerSnap = await tx.get(playerRef);
    if (!playerSnap.exists) {
      const playersSnap = await tx.get(roomRef.collection("players"));
      const usedAvatars = new Set<string>();
      playersSnap.forEach((doc) => {
        const avatar = doc.get("avatar");
        if (typeof avatar === "string") {
          usedAvatars.add(avatar);
        }
      });
      const fallbackAvatar = getAvatarByOrder(playersSnap.size);
      const avatar =
        AVATAR_LIST.find((item) => !usedAvatars.has(item)) ?? fallbackAvatar;
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
    } else {
      const updates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
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

    const roomUpdates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
      lastActiveAt: serverTs,
    };
    const currentDeal = roomData?.deal;
    let totalPlayers: number | null = null;
    if (currentDeal && Array.isArray(currentDeal.players)) {
      const uniquePlayers = currentDeal.players.filter(
        (playerId: string) => typeof playerId === "string"
      );
      if (!uniquePlayers.includes(uid)) {
        uniquePlayers.push(uid);
        roomUpdates["deal.players"] = uniquePlayers;
      }
      totalPlayers = uniquePlayers.length;
    }
    if (totalPlayers !== null && roomData?.order) {
      roomUpdates["order.total"] = totalPlayers;
    }
    tx.update(roomRef, roomUpdates);
  });
}

export const onRejoinRequestCreate = functions.firestore
  .document("rooms/{roomId}/rejoinRequests/{uid}")
  .onCreate(async (_snap, context) => {
    const roomId = context.params.roomId as string;
    const uid = context.params.uid as string;

    const result = await handleRejoinRequest(roomId, uid, "create");
    logger.debug("rejoin.onCreate.result", { roomId, uid, result });
  });

export const onRejoinRequestUpdate = functions.firestore
  .document("rooms/{roomId}/rejoinRequests/{uid}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() as RejoinRequestDoc | undefined;
    const after = change.after.data() as RejoinRequestDoc | undefined;
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

    const roomId = context.params.roomId as string;
    const uid = context.params.uid as string;

    const result = await handleRejoinRequest(roomId, uid, "update");
    logger.debug("rejoin.onUpdate.result", { roomId, uid, result, prevStatus });
  });

export const onRoomWaitingProcessRejoins = functions.firestore
  .document("rooms/{roomId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() as
      | FirebaseFirestore.DocumentData
      | undefined;
    const after = change.after.data() as
      | FirebaseFirestore.DocumentData
      | undefined;
    if (!before || !after) {
      return;
    }
    if ((before.status as string) === "waiting") {
      return;
    }
    if ((after.status as string) !== "waiting") {
      return;
    }

    const roomId = context.params.roomId as string;
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
      } catch (error) {
        logger.error("rejoin.onWaiting.error", { roomId, uid, error });
      }
    }
  });
