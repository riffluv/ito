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
import {
  buildTopicCustomRoomUpdates,
  buildTopicResetRoomUpdates,
  buildTopicSelectOrShuffleRoomUpdates,
  deriveTopicTypeFromAction,
  selectTopicPool,
  validateTopicTypeForAction,
  type TopicAction,
} from "@/lib/server/roomCommandsTopic/helpers";

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
    await roomRef.update(buildTopicResetRoomUpdates({ serverNow }));

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
    await roomRef.update(buildTopicCustomRoomUpdates({ topic, serverNow }));
    traceAction("topic.custom.server", { roomId: params.roomId, uid });
    return;
  }

  const type = deriveTopicTypeFromAction(params.action);
  const topicType = type && isTopicTypeValue(type) ? (type as TopicType) : null;
  const validation = validateTopicTypeForAction({ action: params.action, topicType });
  if (validation === "invalid_topic_type") {
    throw codedError("invalid_payload", "invalid_payload", "invalid_topic_type");
  }
  if (validation === "missing_topic_type") {
    throw codedError("invalid_payload", "invalid_payload", "missing_topic_type");
  }

  const pool = selectTopicPool(sections, topicType);
  const picked = pickOne(pool) || null;
  await roomRef.update(
    buildTopicSelectOrShuffleRoomUpdates({
      topicBox: topicType,
      topic: picked,
      serverNow,
    })
  );

  traceAction(params.action.kind === "select" ? "topic.select.server" : "topic.shuffle.server", {
    roomId: params.roomId,
    uid,
    topicBox: topicType,
    topic: picked ?? undefined,
  });
}
