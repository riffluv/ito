/**
 * Pure host action model.
 * Receives current room snapshot and players/onlineCount, returns an ordered
 * list of action intents (no side-effects, no onClick binding).
 * UI層（useHostActions）が onClick を割当てて使用する。
 */
import type { RoomDoc, PlayerDoc } from "@/lib/types";

export type HostIntentKey =
  | "primary"
  | "pickTopic"
  | "deal"
  | "shuffle"
  | "reselect"
  | "evaluate";

export type HostIntent = {
  key: HostIntentKey;
  label: string;
  disabled?: boolean;
  /** disabledの理由などUIヒント */
  reason?: string;
  /** 追加情報（pickTopicのカテゴリ名など） */
  payload?: any;
  palette?: "brand" | "orange" | "gray" | "teal";
  variant?: "solid" | "outline" | "ghost" | "subtle" | "soft" | "link";
};

export function buildHostActionModel(
  room: RoomDoc & { id?: string },
  players: (PlayerDoc & { id: string })[],
  onlineCount: number | undefined,
  topicTypeLabels: readonly string[],
  hostPrimary: { label: string } | null
): HostIntent[] {
  const MIN_PLAYERS_FOR_DEAL = 2;
  const status = (room as any)?.status as string | undefined;
  const resolveMode = (room as any)?.options?.resolveMode as string | undefined;
  const topicSelected = !!(room as any)?.topic;
  const proposal: string[] = ((room as any)?.order?.proposal || []) as string[];
  const assigned = players.filter((p) => typeof (p as any)?.number === "number").length;

  const intents: HostIntent[] = [];

  // primary（開始/もう一度）
  if ((status === "waiting" || status === "finished") && hostPrimary) {
    intents.push({ key: "primary", label: hostPrimary.label, palette: "orange" });
  }

  if (status === "clue") {
    if (!topicSelected) {
      // カテゴリ3択のみ（自動決定しない）
      for (const cat of topicTypeLabels) {
        intents.push({ key: "pickTopic", label: cat, palette: "brand", payload: { category: cat } });
      }
      return intents;
    }

    // お題選択済み → シャッフル / 数字配布 / お題を選び直す
    intents.push({ key: "shuffle", label: "シャッフル", variant: "outline" });

    const tooFewPlayers = typeof onlineCount === "number" && onlineCount < MIN_PLAYERS_FOR_DEAL;
    intents.push({
      key: "deal",
      label: "数字配布",
      variant: "outline",
      disabled: tooFewPlayers,
      reason: tooFewPlayers ? `プレイヤーは${MIN_PLAYERS_FOR_DEAL}人以上必要です` : undefined,
    });

    intents.push({ key: "reselect", label: "お題を選び直す", variant: "ghost" });

    if (resolveMode === "sort-submit") {
      const canEval = proposal.length > 0 && proposal.length === assigned;
      intents.push({
        key: "evaluate",
        label: "せーので判定",
        palette: "teal",
        disabled: !canEval,
        reason: canEval ? undefined : "全員のカードが場にありません",
      });
    }
  }

  return intents;
}
