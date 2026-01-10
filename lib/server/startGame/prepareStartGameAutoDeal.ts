import { buildDealPayload, selectDealTargetPlayers } from "@/lib/game/domain";
import { generateDeterministicNumbers } from "@/lib/game/random";
import { pickOne, type TopicType } from "@/lib/topics";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import {
  codedError,
  isTopicTypeValue,
  loadTopicSectionsFromFs,
  sanitizeTopicText,
} from "@/lib/server/roomCommandShared";
import { fetchPresenceUids } from "@/lib/server/roomCommandAdminOps";

export async function prepareStartGameAutoDeal(params: {
  roomId: string;
  roomForAuth: RoomDoc | undefined;
  playersSnap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
  topicType?: string | null;
  customTopic?: string | null;
  presenceUids?: string[] | null;
}): Promise<{
  dealPayload: ReturnType<typeof buildDealPayload>;
  orderedPlayers: { id: string; uid?: string }[];
  topic: string | null;
  topicBox: TopicType | "カスタム" | null;
}> {
  const now = Date.now();
  const presenceUids = params.presenceUids ?? (await fetchPresenceUids(params.roomId));
  const candidates = params.playersSnap.docs.map((docSnap) => {
    const data = docSnap.data() as PlayerDoc | undefined;
    const lastSeenRaw = (data as { lastSeen?: unknown })?.lastSeen;
    const lastSeen = (lastSeenRaw ?? null) as number | FirebaseFirestore.Timestamp | Date | null;
    return {
      id: docSnap.id,
      uid: typeof data?.uid === "string" ? data.uid : undefined,
      lastSeen,
    } as const;
  });
  const target = selectDealTargetPlayers(candidates, presenceUids, now);
  let ordered = [...target].sort((a, b) => String(a.uid || a.id).localeCompare(String(b.uid || b.id)));
  const eligibleCount = candidates.filter((c) => typeof c.uid === "string" && c.uid.trim().length > 0).length;
  const suspectedMismatch = eligibleCount > 1 && ordered.length <= 1;
  if (suspectedMismatch) {
    const fallbackOrdered = [...candidates].sort((a, b) => String(a.uid || a.id).localeCompare(String(b.uid || b.id)));
    if (fallbackOrdered.length > ordered.length) {
      ordered = fallbackOrdered;
    }
  }
  if (ordered.length === 0) {
    throw codedError("no_players", "no_players", "no_eligible_players");
  }

  // topic 決定（nextRound と同等のロジックを流用）
  const sections = await loadTopicSectionsFromFs();
  const requestedTopicType = params.topicType ?? params.roomForAuth?.options?.defaultTopicType ?? "通常版";
  const normalizedTopicType =
    typeof requestedTopicType === "string" && isTopicTypeValue(requestedTopicType)
      ? (requestedTopicType as TopicType)
      : ("通常版" as TopicType);

  let topic: string | null = null;
  let topicBox: TopicType | "カスタム" | null =
    (params.roomForAuth?.topicBox as TopicType | "カスタム" | null | undefined) ?? normalizedTopicType;

  if (topicBox === "カスタム") {
    const customText = params.customTopic ? sanitizeTopicText(params.customTopic) : null;
    if (customText && customText.trim().length > 0) {
      topic = customText;
      topicBox = "カスタム";
    } else if (params.roomForAuth?.topic && String(params.roomForAuth.topicBox) === "カスタム") {
      topic = params.roomForAuth.topic;
      topicBox = "カスタム";
    } else {
      const pool = sections.normal;
      topic = pickOne(pool) || null;
      topicBox = "通常版";
    }
  } else {
    const pool =
      normalizedTopicType === "通常版"
        ? sections.normal
        : normalizedTopicType === "レインボー版"
          ? sections.rainbow
          : sections.classic;
    topic = pickOne(pool) || null;
  }

  const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const min = 1;
  const max = 100;
  const playerIds = ordered.map((p) => p.id);
  const generatedNumbers = generateDeterministicNumbers(playerIds.length, min, max, seed);
  const dealPayload = buildDealPayload(playerIds, seed, min, max, generatedNumbers);

  return {
    dealPayload,
    orderedPlayers: ordered,
    topic,
    topicBox,
  };
}
