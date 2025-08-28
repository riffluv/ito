/**
 * Pure host action model.
 * Receives current room snapshot and players/onlineCount, returns an ordered
 * list of action intents (no side-effects, no onClick binding).
 * UI層（useHostActions）が onClick を割当てて使用する。
 */
import type { RoomDoc, PlayerDoc } from "@/lib/types";

export type HostIntentKey =
  | "primary"
  | "quickStart"
  | "advancedMode"
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

  // finished状態でのみprimaryアクション（もう一度）を表示
  if (status === "finished" && hostPrimary) {
    intents.push({ key: "primary", label: hostPrimary.label, palette: "orange" });
  }

  if (status === "clue") {
    if (!topicSelected) {
      // メイン: ワンクリック開始
      intents.push({ 
        key: "quickStart", 
        label: "🚀 ワンクリック開始", 
        palette: "orange",
        variant: "solid"
      });
      
      // 上級者向け: 詳細設定
      intents.push({ 
        key: "advancedMode", 
        label: "⚙️ 詳細設定", 
        palette: "gray",
        variant: "outline"
      });
      
      return intents;
    }

    // お題選択済みの場合は sort-submit の評価ボタンのみ表示
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
