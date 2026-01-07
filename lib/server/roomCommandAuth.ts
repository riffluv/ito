import { FieldValue } from "firebase-admin/firestore";

import { getAdminAuth, getAdminDb } from "@/lib/server/firebaseAdmin";
import { verifyHostSession } from "@/lib/server/hostToken";
import { AVATAR_LIST, getAvatarByOrder } from "@/lib/utils";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { codedError, sanitizeName } from "@/lib/server/roomCommandShared";

async function verifyToken(token: string): Promise<string> {
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const uid = decoded?.uid;
    if (!uid) {
      throw codedError("unauthorized", "unauthorized", "uid_missing");
    }
    return uid;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[verifyToken] failed", (error as Error)?.message);
    throw codedError(
      "unauthorized",
      "unauthorized",
      (error as Error | undefined)?.message
    );
  }
}

export async function verifyHostIdentity(
  room: RoomDoc | undefined,
  token: string,
  roomId: string,
  sessionId?: string | null
): Promise<string> {
  if (sessionId) {
    const session = await verifyHostSession(sessionId, roomId);
    if (session?.uid) {
      return session.uid;
    }
  }
  const uid = await verifyToken(token);
  const hostId = room?.hostId;
  const creatorId = room?.creatorId;
  if (hostId && hostId !== uid && creatorId !== uid) {
    throw codedError("forbidden", "forbidden", "host_only");
  }
  return uid;
}

export async function verifyViewerIdentity(token: string): Promise<string> {
  return verifyToken(token);
}

async function chooseAvatar(roomId: string): Promise<string> {
  const db = getAdminDb();
  const snap = await db.collection("rooms").doc(roomId).collection("players").get();
  const used = new Set<string>();
  snap.forEach((d) => {
    const avatar = (d.data() as { avatar?: unknown })?.avatar;
    if (typeof avatar === "string") used.add(avatar);
  });
  const available = AVATAR_LIST.filter((a) => !used.has(a));
  if (available.length === 0) {
    return getAvatarByOrder(0);
  }
  const idx = Math.floor(Math.random() * available.length);
  return available[idx]!;
}

export async function ensurePlayerDoc(params: {
  roomId: string;
  uid: string;
  displayName: string | null;
}): Promise<{ joined: boolean; avatar: string | null }> {
  const { roomId, uid } = params;
  const displayName = params.displayName ? sanitizeName(params.displayName) : "匿名";
  const db = getAdminDb();
  const playerRef = db.collection("rooms").doc(roomId).collection("players").doc(uid);
  const snap = await playerRef.get();
  if (snap.exists) {
    const patch: Partial<PlayerDoc> = {
      lastSeen: FieldValue.serverTimestamp() as unknown as PlayerDoc["lastSeen"],
    };
    if (displayName && snap.data()?.name !== displayName) {
      patch.name = displayName;
    }
    await playerRef.update(patch);
    return { joined: false, avatar: (snap.data() as PlayerDoc | undefined)?.avatar ?? null };
  }

  const avatar = await chooseAvatar(roomId);
  const payload: PlayerDoc = {
    name: displayName,
    avatar,
    number: null,
    clue1: "",
    ready: false,
    orderIndex: 0,
    uid,
    lastSeen: FieldValue.serverTimestamp() as unknown as PlayerDoc["lastSeen"],
    joinedAt: FieldValue.serverTimestamp() as unknown as PlayerDoc["joinedAt"],
  };
  await playerRef.set(payload);
  return { joined: true, avatar };
}

