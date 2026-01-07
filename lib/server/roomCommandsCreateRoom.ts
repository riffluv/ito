import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { APP_VERSION } from "@/lib/constants/appVersion";
import { createInitialRoomStats } from "@/lib/game/domain";
import { getAvatarByOrder } from "@/lib/utils";
import { generateRoomId } from "@/lib/utils/roomId";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { normalizeVersion } from "@/lib/server/roomVersionGate";
import {
  codedError,
  safeTraceAction,
  sanitizeName,
} from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";
import type { PlayerDoc, RoomDoc } from "@/lib/types";

type WithAuth = { token: string };

export type CreateRoomParams = WithAuth & {
  roomName: string;
  displayName: string;
  displayMode?: string | null;
  options?: RoomDoc["options"];
  passwordHash?: string | null;
  passwordSalt?: string | null;
  passwordVersion?: number | null;
};

export async function createRoom(params: CreateRoomParams): Promise<{ roomId: string; appVersion: string }> {
  const uid = await verifyViewerIdentity(params.token);
  const roomName = sanitizeName(params.roomName);
  const displayName = sanitizeName(params.displayName || "匿名");
  const db = getAdminDb();
  const createdAt = FieldValue.serverTimestamp() as unknown as Timestamp;
  const lastActiveAt = FieldValue.serverTimestamp() as unknown as Timestamp;

  const basePayload = {
    name: roomName,
    hostId: uid,
    hostName: displayName,
    creatorId: uid,
    creatorName: displayName,
    appVersion: normalizeVersion(APP_VERSION) ?? APP_VERSION,
    options: params.options ?? {},
    status: "waiting",
    createdAt,
    lastActiveAt,
    closedAt: null,
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 12 * 60 * 60 * 1000)),
    topic: null,
    topicOptions: null,
    topicBox: null,
    result: null,
    stats: createInitialRoomStats(),
    requiresPassword: !!params.passwordHash,
    passwordHash: params.passwordHash ?? null,
    passwordSalt: params.passwordSalt ?? null,
    passwordVersion: params.passwordVersion ?? null,
    deal: null,
    order: null,
    mvpVotes: {},
    round: 0,
    ui: { recallOpen: true },
    statusVersion: 0,
  } as unknown as RoomDoc & { createdAt: Timestamp; lastActiveAt: Timestamp };

  const MAX_ATTEMPTS = 8;
  let roomId: string | null = null;
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    const candidate = generateRoomId();
    const ref = db.collection("rooms").doc(candidate);
    const existing = await ref.get();
    if (existing.exists) continue;
    await ref.set(basePayload);
    await ref.collection("players").doc(uid).set({
      name: displayName,
      avatar: getAvatarByOrder(0),
      number: null,
      clue1: "",
      ready: false,
      orderIndex: 0,
      uid,
      lastSeen: FieldValue.serverTimestamp(),
      joinedAt: FieldValue.serverTimestamp(),
    } satisfies PlayerDoc);
    roomId = candidate;
    break;
  }

  if (!roomId) {
    throw codedError("room_id_allocation_failed", "room_id_allocation_failed");
  }

  safeTraceAction("room.create.server", { roomId, uid });
  return { roomId, appVersion: basePayload.appVersion ?? APP_VERSION };
}

