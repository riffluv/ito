import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {
  defaultTopics,
  getTopicsByType,
  parseItoWordMarkdown,
  topicTypeLabels,
  type TopicSections,
  type TopicType,
} from "@/lib/topics";
import { generateDeterministicNumbers } from "@/lib/game/random";

type QuickStartOptions = {
  defaultTopicType?: string | null;
  skipPresence?: boolean;
  customTopic?: string | null;
};

type QuickStartRequest = {
  roomId?: unknown;
  options?: QuickStartOptions | null;
};

type QuickStartResult = {
  roomId: string;
  assignedCount: number;
  topicType: string;
  topic?: string | null;
  durationMs: number;
};

const db = admin.firestore();
const rtdb = (() => {
  try {
    return admin.database();
  } catch {
    return null;
  }
})();

const TOPIC_SOURCE_URL =
  process.env.TOPIC_SOURCE_URL || "https://online-ito.vercel.app/itoword.md";

const TOPIC_TYPE_SET = new Set<string>(topicTypeLabels as readonly string[]);
const FALLBACK_TOPIC_TYPE: TopicType = topicTypeLabels[0];

let cachedTopicSections: TopicSections | null = null;
let lastTopicFetchErrorLoggedAt = 0;

function traceAction(name: string, detail: Record<string, unknown>) {
  console.log(`[trace] action:${name}`, detail);
}

function traceError(name: string, detail: Record<string, unknown>, error: unknown) {
  console.error(`[trace] error:${name}`, detail, error);
}

function normalizeTopicType(type: unknown): TopicType {
  if (typeof type !== "string" || type.trim().length === 0) {
    return FALLBACK_TOPIC_TYPE;
  }
  const trimmed = type.trim();
  if (trimmed === "カスタム") {
    return FALLBACK_TOPIC_TYPE;
  }
  if (TOPIC_TYPE_SET.has(trimmed)) {
    return trimmed as TopicType;
  }
  return FALLBACK_TOPIC_TYPE;
}

async function loadTopicSections(): Promise<TopicSections | null> {
  if (cachedTopicSections) return cachedTopicSections;
  try {
    const res = await fetch(TOPIC_SOURCE_URL);
    if (!res.ok) {
      throw new Error(`fetch failed (${res.status})`);
    }
    const text = await res.text();
    cachedTopicSections = parseItoWordMarkdown(text);
    return cachedTopicSections;
  } catch (error) {
    const now = Date.now();
    if (now - lastTopicFetchErrorLoggedAt > 60_000) {
      console.warn("[quickStart] Failed to load topic sections", error);
      lastTopicFetchErrorLoggedAt = now;
    }
    return null;
  }
}

async function resolveTopic(type: TopicType): Promise<string | null> {
  const sections = (await loadTopicSections()) ?? {
    normal: defaultTopics,
    rainbow: defaultTopics,
    classic: defaultTopics,
  };
  const pool = getTopicsByType(sections, type) ?? [];
  if (pool.length === 0) return null;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? null;
}

async function fetchPresenceUids(roomId: string): Promise<string[] | null> {
  if (!rtdb) return null;
  try {
    const snap = await rtdb.ref(`presence/${roomId}`).get();
    if (!snap.exists()) return null;
    const raw = snap.val() as Record<string, Record<string, { online?: boolean }>> | null;
    if (!raw || typeof raw !== "object") return null;
    const result: string[] = [];
    for (const [uid, connections] of Object.entries(raw)) {
      if (!connections || typeof connections !== "object") continue;
      const online = Object.values(connections).some(
        (conn) => conn && typeof conn === "object" && conn.online !== false
      );
      if (online) {
        result.push(uid);
      }
    }
    return result.length > 0 ? result : null;
  } catch {
    return null;
  }
}

function orderPlayerIds(
  players: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[],
  presence: string[] | null
): string[] {
  const presenceSet = presence ? new Set(presence) : null;
  return players
    .map((doc) => doc.id)
    .sort((a, b) => {
      if (presenceSet) {
        const aOnline = presenceSet.has(a);
        const bOnline = presenceSet.has(b);
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;
      }
      return a.localeCompare(b);
    });
}

async function resetPlayerState(roomId: string) {
  const playersRef = db.collection("rooms").doc(roomId).collection("players");
  const snap = await playersRef.get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      number: null,
      clue1: "",
      ready: false,
      orderIndex: 0,
    });
  });
  await batch.commit();
}

export const quickStart = functions.https.onCall(
  async (data: QuickStartRequest, context): Promise<QuickStartResult> => {
    const startedAt = Date.now();
    const uid = context.auth?.uid ?? null;
    if (!uid) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }

    const roomId = typeof data?.roomId === "string" ? data.roomId.trim() : "";
    if (!roomId) {
      throw new functions.https.HttpsError("invalid-argument", "roomId is required.");
    }

    const options = data?.options ?? {};
    traceAction("quickStart.function.begin", {
      roomId,
      callerUid: uid,
    });

    const roomRef = db.collection("rooms").doc(roomId);
    let roomData: Record<string, unknown> | null = null;
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(roomRef);
        if (!snap.exists) {
          throw new functions.https.HttpsError("not-found", "Room not found.");
        }
        roomData = (snap.data() ?? {}) as Record<string, unknown>;
        const currentStatus = typeof roomData?.status === "string" ? roomData.status : "waiting";
        if (currentStatus !== "waiting") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "The room is not waiting."
          );
        }
        const hostId = typeof roomData?.hostId === "string" ? roomData.hostId : null;
        if (hostId && hostId !== uid) {
          throw new functions.https.HttpsError("permission-denied", "Only the host can start.");
        }
        tx.update(roomRef, {
          status: "clue",
          result: null,
          deal: null,
          order: null,
          mvpVotes: {},
          lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
          "ui.recallOpen": false,
        });
      });
    } catch (error) {
      traceError(
        "quickStart.function.failed",
        { roomId, stage: "startGame" },
        error
      );
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", "Failed to start the room.", `${error}`);
    }

    await resetPlayerState(roomId);

    const roomDataAny = roomData as Record<string, any> | null;
    const roomOptions =
      roomDataAny && typeof roomDataAny.options === "object"
        ? (roomDataAny.options as Record<string, unknown>)
        : null;
    const requestedTopicType =
      options.defaultTopicType ??
      (typeof roomOptions?.defaultTopicType === "string" ? (roomOptions.defaultTopicType as string) : null);
    const normalizedTopicType = normalizeTopicType(requestedTopicType);
    let resolvedTopic: string | null = null;

    const customRequested =
      typeof requestedTopicType === "string" && requestedTopicType.trim() === "カスタム";
    const providedCustomTopic =
      typeof options.customTopic === "string" ? options.customTopic.trim() : "";
    if (customRequested) {
      const existingTopic =
        roomDataAny && typeof roomDataAny.topic === "string" ? (roomDataAny.topic as string).trim() : "";
      const topic = providedCustomTopic || existingTopic;
      if (!topic) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Custom topic text is required before starting."
        );
      }
      resolvedTopic = topic;
      await roomRef.update({
        topic,
        topicBox: "カスタム",
        topicOptions: null,
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      resolvedTopic = await resolveTopic(normalizedTopicType);
      await roomRef.update({
        topicBox: normalizedTopicType,
        topic: resolvedTopic ?? null,
        topicOptions: null,
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const playersRef = roomRef.collection("players");
    const playerSnap = await playersRef.get();
    if (playerSnap.empty) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Cannot start without any players."
      );
    }

    const skipPresence = options.skipPresence === true;
    const presenceUids = skipPresence ? null : await fetchPresenceUids(roomId);
    const orderedPlayerIds = orderPlayerIds(playerSnap.docs, presenceUids);

    const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const numbers = generateDeterministicNumbers(orderedPlayerIds.length, 1, 100, seed);
    const numberMap = orderedPlayerIds.reduce<Record<string, number | null>>((acc, id, index) => {
      acc[id] = typeof numbers[index] === "number" ? numbers[index] : null;
      return acc;
    }, {});
    const seatHistory = orderedPlayerIds.reduce<Record<string, number>>((acc, id, index) => {
      acc[id] = index;
      return acc;
    }, {});

    await roomRef.update({
      deal: {
        seed,
        min: 1,
        max: 100,
        players: orderedPlayerIds,
        seatHistory,
      },
      "order.total": orderedPlayerIds.length,
      "order.numbers": numberMap,
      lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    try {
      await db.collection("roomProposals").doc(roomId).set(
        {
          proposal: [],
          seed,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.warn("[quickStart] Failed to reset roomProposals", { roomId, error });
    }

    const durationMs = Date.now() - startedAt;
    const result: QuickStartResult = {
      roomId,
      assignedCount: orderedPlayerIds.length,
      topicType: customRequested ? "カスタム" : normalizedTopicType,
      topic: resolvedTopic ?? null,
      durationMs,
    };

    traceAction("quickStart.function.complete", {
      roomId,
      durationMs,
      assigned: String(orderedPlayerIds.length),
      topicType: result.topicType,
    });

    return result;
  }
);
