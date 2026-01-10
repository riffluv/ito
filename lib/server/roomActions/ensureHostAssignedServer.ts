import { FieldValue, type QueryDocumentSnapshot } from "firebase-admin/firestore";

import { HostManager, buildHostPlayerInputsFromSnapshots } from "@/lib/host/HostManager";
import { getAdminDb, getAdminRtdb } from "@/lib/server/firebaseAdmin";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { logDebug } from "@/lib/utils/log";

import { fetchPresenceUids } from "./presence";
import {
  computeDedupeDeletes,
  deriveCreatorUpdates,
  filterCanonicalPlayers,
  findPlayerDocByUid,
  isPlayerRegistered,
  resolveEffectiveHostId,
  shouldKeepExistingHost,
  trimOrNull,
  type RoomUpdateMap,
} from "./ensureHostAssignedServer/helpers";

export async function ensureHostAssignedServer(roomId: string, uid: string) {
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(roomId);
  await db.runTransaction(async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists) return;

    const room = roomSnap.data() as RoomDoc | undefined;
    const currentHost = trimOrNull(room?.hostId);

    const baseUpdates = deriveCreatorUpdates({
      existingCreatorId: trimOrNull(room?.creatorId),
      existingCreatorName: trimOrNull(room?.creatorName),
      currentHostId: currentHost,
      roomHostName: trimOrNull(room?.hostName),
      fieldDelete: FieldValue.delete(),
    });

    const playersRef = roomRef.collection("players");
    const playersSnap = await tx.get(playersRef);
    if (playersSnap.empty) return;

    const playerDocs = playersSnap.docs as QueryDocumentSnapshot<PlayerDoc>[];

    const normalizedHostId = currentHost ? currentHost : null;
    const hostStillRegistered = isPlayerRegistered(playerDocs, normalizedHostId);

    const meDoc = findPlayerDocByUid(playerDocs, uid);
    if (!meDoc) return;

    const deleteDocIds = computeDedupeDeletes({
      playerDocs,
      uid,
      keepDocId: meDoc.id,
    });
    deleteDocIds.forEach((id) => {
      const doc = playerDocs.find((d) => d.id === id);
      if (doc) tx.delete(doc.ref);
    });
    const canonicalDocs = filterCanonicalPlayers({
      playerDocs,
      deleteDocIds: new Set(deleteDocIds),
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
    if (
      shouldKeepExistingHost({
        currentHostId: normalizedHostId,
        uid,
        hostStillRegistered,
        hostOnline,
      })
    ) {
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

    const effectiveHostId = resolveEffectiveHostId({
      currentHostId: normalizedHostId,
      hostStillRegistered,
      hostOnline,
    });
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
