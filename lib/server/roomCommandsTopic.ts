import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import type { RoomDoc } from "@/lib/types";
import { pickOne, type TopicType } from "@/lib/topics";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  codedError,
  isTopicTypeValue,
  loadTopicSectionsFromFs,
  sanitizeTopicText,
} from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";

type TopicAction =
  | { kind: "select"; type: TopicType }
  | { kind: "shuffle"; type: TopicType | null }
  | { kind: "custom"; text: string }
  | { kind: "reset" };

export async function topicCommand(params: { token: string; roomId: string; action: TopicAction }) {
  const uid = await verifyViewerIdentity(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) throw codedError("room_not_found", "room_not_found");
  const room = roomSnap.data() as RoomDoc | undefined;
  const isHost = !room?.hostId || room.hostId === uid || room?.creatorId === uid;
  if (!isHost) throw codedError("forbidden", "forbidden", "host_only");

  const sections = await loadTopicSectionsFromFs();
  const serverNow = FieldValue.serverTimestamp();

  if (params.action.kind === "reset") {
    if (room?.status === "clue" || room?.status === "reveal") {
      throw codedError("invalid_status", "invalid_status", "reset_forbidden");
    }
    const updates: Partial<RoomDoc> & Record<string, unknown> = {
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
      lastActiveAt: serverNow,
    };
    await roomRef.update(updates);

    try {
      const playersSnap = await roomRef.collection("players").get();
      const batch = db.batch();
      playersSnap.forEach((docSnap) => {
        batch.update(docSnap.ref, {
          clue1: "",
          ready: false,
        });
      });
      await batch.commit();
    } catch (error) {
      traceError("topic.reset.players", error, { roomId: params.roomId });
    }
    traceAction("topic.reset.server", { roomId: params.roomId, uid });
    return;
  }

  if (params.action.kind === "custom") {
    const topic = sanitizeTopicText(params.action.text);
    if (!topic) throw codedError("invalid_payload", "invalid_payload", "empty_topic");
    await roomRef.update({
      topic,
      topicBox: "カスタム",
      topicOptions: null,
      lastActiveAt: serverNow,
    });
    traceAction("topic.custom.server", { roomId: params.roomId, uid });
    return;
  }

  const type = params.action.kind === "select" ? params.action.type : params.action.type ?? null;
  const topicType = type && isTopicTypeValue(type) ? (type as TopicType) : null;
  const pool = topicType
    ? topicType === "通常版"
      ? sections.normal
      : topicType === "レインボー版"
        ? sections.rainbow
        : sections.classic
    : [];
  const picked = pickOne(pool) || null;

  if (params.action.kind === "select" && !topicType) {
    throw codedError("invalid_payload", "invalid_payload", "invalid_topic_type");
  }

  if (params.action.kind === "shuffle" && !topicType) {
    throw codedError("invalid_payload", "invalid_payload", "missing_topic_type");
  }

  await roomRef.update({
    topicBox: topicType ?? null,
    topicOptions: null,
    topic: picked,
    lastActiveAt: serverNow,
  });

  traceAction(params.action.kind === "select" ? "topic.select.server" : "topic.shuffle.server", {
    roomId: params.roomId,
    uid,
    topicBox: topicType,
    topic: picked ?? undefined,
  });
}

