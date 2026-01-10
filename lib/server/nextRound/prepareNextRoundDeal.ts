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

export async function prepareNextRoundDeal(params: {
  roomId: string;
  room: RoomDoc | undefined;
  playersSnap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
  topicType?: string | null;
  customTopic?: string | null;
  presenceUids?: string[] | null;
}): Promise<{
  ordered: { id: string; uid?: string }[];
  topic: string | null;
  topicBox: string | null;
  seed: string;
  dealPayload: ReturnType<typeof buildDealPayload>;
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

  // 配布対象プレイヤーを選定
  const target = selectDealTargetPlayers(candidates, presenceUids, now);
  let ordered = [...target].sort((a, b) => String(a.uid || a.id).localeCompare(String(b.uid || b.id)));

  // フォールバック: eligibleCount > 1 なのに ordered が 1 以下の場合
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

  // topic を決定
  const sections = await loadTopicSectionsFromFs();
  const requestedTopicType = params.topicType ?? params.room?.options?.defaultTopicType ?? "通常版";
  const normalizedTopicType =
    typeof requestedTopicType === "string" && isTopicTypeValue(requestedTopicType)
      ? (requestedTopicType as TopicType)
      : ("通常版" as TopicType);

  let topic: string | null = null;
  let topicBox: string | null = params.room?.topicBox ?? normalizedTopicType;

  if (topicBox === "カスタム") {
    // カスタムお題の場合
    const customText = params.customTopic ? sanitizeTopicText(params.customTopic) : null;
    if (customText && customText.trim().length > 0) {
      topic = customText;
      topicBox = "カスタム";
    } else if (params.room?.topic && String(params.room.topicBox) === "カスタム") {
      // 前回のカスタムお題を引き継ぐ
      topic = params.room.topic;
      topicBox = "カスタム";
    } else {
      // カスタムお題がない場合は通常版にフォールバック
      const pool = sections.normal;
      topic = pickOne(pool) || null;
      topicBox = "通常版";
    }
  } else {
    // 標準お題の場合
    const pool =
      normalizedTopicType === "通常版"
        ? sections.normal
        : normalizedTopicType === "レインボー版"
          ? sections.rainbow
          : sections.classic;
    topic = pickOne(pool) || null;
  }

  // numbers を生成
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const min = 1;
  const max = 100;
  const playerIds = ordered.map((p) => p.id);
  const generatedNumbers = generateDeterministicNumbers(playerIds.length, min, max, seed);
  const dealPayload = buildDealPayload(playerIds, seed, min, max, generatedNumbers);

  return { ordered, topic, topicBox, seed, dealPayload };
}
