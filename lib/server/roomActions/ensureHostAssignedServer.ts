import { FieldValue, type QueryDocumentSnapshot } from "firebase-admin/firestore";

import { HostManager, buildHostPlayerInputsFromSnapshots } from "@/lib/host/HostManager";
import { getAdminDb, getAdminRtdb } from "@/lib/server/firebaseAdmin";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { logDebug } from "@/lib/utils/log";

import { fetchPresenceUids } from "./presence";

type RoomUpdateMap = Record<string, unknown>;

export async function ensureHostAssignedServer(roomId: string, uid: string) {
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(roomId);
  await db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists) return;

    const room = roomSnap.data() as RoomDoc | undefined;
    const currentHost =
      typeof room?.hostId === "string" && room.hostId.trim() ? room.hostId.trim() : null;

    const existingCreatorId =
      typeof room?.creatorId === "string" && room.creatorId.trim() ? room.creatorId.trim() : null;
    const existingCreatorName =
      typeof room?.creatorName === "string" && room.creatorName.trim()
        ? room.creatorName.trim()
        : null;

    const baseUpdates: RoomUpdateMap = {};
    if (!existingCreatorId && currentHost) {
      baseUpdates.creatorId = currentHost;
      if (typeof room?.hostName === "string" && room.hostName.trim()) {
        baseUpdates.creatorName = room.hostName.trim();
      } else if (existingCreatorName === null) {
        baseUpdates.creatorName = FieldValue.delete();
      }
    }

    const playersRef = roomRef.collection("players");
    const playersSnap = await tx.get(playersRef);
    if (playersSnap.empty) return;

    const playerDocs = playersSnap.docs as QueryDocumentSnapshot<PlayerDoc>[];

    const normalizedHostId = currentHost ? currentHost : null;
    const hostStillRegistered = normalizedHostId
      ? playerDocs.some((doc) => {
          if (doc.id === normalizedHostId) return true;
          const data = doc.data() as PlayerDoc;
          return typeof data?.uid === "string" && data.uid === normalizedHostId;
        })
      : false;

    const meDoc =
      playerDocs.find((doc) => doc.id === uid) ||
      playerDocs.find((doc) => {
        const data = doc.data() as PlayerDoc;
        return typeof data?.uid === "string" && data.uid === uid;
      });
    if (!meDoc) return;

    const canonicalDocs = playerDocs.filter((doc) => {
      if (doc.id === meDoc.id) return true;
      const data = doc.data() as PlayerDoc;
      const sameUid = typeof data?.uid === "string" && data.uid === uid;
      if (sameUid || doc.id === uid) {
        tx.delete(doc.ref);
        return false;
      }
      return true;
    });

    const rtdb = getAdminRtdb();
    const onlineSet = new Set<string>();
    onlineSet.add(meDoc.id);
    if (meDoc.id !== uid) onlineSet.add(uid);

    if (rtdb) {
      try {
        const online = await fetchPresenceUids(roomId, rtdb);
        for (const onlineUid of online) {
          onlineSet.add(onlineUid);
        }
      } catch {}
    }

    const hostOnline = normalizedHostId ? onlineSet.has(normalizedHostId) : false;
    if (normalizedHostId && normalizedHostId !== uid && hostStillRegistered && hostOnline) {
      if (Object.keys(baseUpdates).length > 0) {
        tx.update(roomRef, baseUpdates);
      }
      return;
    }

    const playerInputs = buildHostPlayerInputsFromSnapshots({
      docs: canonicalDocs,
      getJoinedAt: (doc) => (doc.createTime ? doc.createTime.toMillis() : null),
      getOrderIndex: (doc) => {
        const data = doc.data() as PlayerDoc;
        return typeof data?.orderIndex === "number" ? data.orderIndex : null;
      },
      getName: (doc) => {
        const data = doc.data() as PlayerDoc;
        return typeof data?.name === "string" ? data.name : null;
      },
      onlineIds: onlineSet,
    });

    const effectiveHostId = normalizedHostId && hostStillRegistered && hostOnline ? currentHost : null;
    const manager = new HostManager({
      roomId,
      currentHostId: effectiveHostId,
      players: playerInputs,
    });

    const decision = manager.evaluateClaim(uid);

    if (decision.action !== "assign") {
      if (Object.keys(baseUpdates).length > 0) {
        tx.update(roomRef, baseUpdates);
      }
      return;
    }

    const updates: RoomUpdateMap = { ...baseUpdates, hostId: decision.hostId };
    const meta = manager.getPlayerMeta(decision.hostId);
    const trimmedName = meta?.name && typeof meta.name === "string" ? meta.name.trim() : "";
    if (trimmedName) {
      updates.hostName = trimmedName;
    } else {
      updates.hostName = FieldValue.delete();
    }

    tx.update(roomRef, updates);
    logDebug("rooms", "host-claim assigned-server", {
      roomId,
      uid,
      hostId: decision.hostId,
      reason: decision.reason,
    });
  });
}

