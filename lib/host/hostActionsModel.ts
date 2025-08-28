/**
 * Pure host action model.
 * Receives current room snapshot and players/onlineCount, returns
 * UI-agnostic host action intents (labels, states). No side effects here.
 */
import type { RoomDoc, PlayerDoc } from "@/lib/types";

export type HostIntentKey = "primary" | "quickStart" | "advancedMode" | "evaluate";

export type HostIntent = {
  key: HostIntentKey;
  label: string;
  disabled?: boolean;
  reason?: string;
  payload?: any;
  palette?: "brand" | "orange" | "gray" | "teal";
  variant?: "solid" | "outline" | "ghost" | "subtle" | "soft" | "link";
};

export function buildHostActionModel(
  room: RoomDoc & { id?: string },
  players: (PlayerDoc & { id: string })[],
  _onlineCount: number | undefined,
  _topicTypeLabels: readonly string[],
  hostPrimary: { label: string } | null
): HostIntent[] {
  const status = (room as any)?.status as string | undefined;
  const resolveMode = (room as any)?.options?.resolveMode as string | undefined;
  const topicSelected = !!(room as any)?.topic;
  const proposal: string[] = ((room as any)?.order?.proposal || []) as string[];
  const assigned = players.filter((p) => typeof (p as any)?.number === "number").length;

  const intents: HostIntent[] = [];

  // waiting: primaryは出さず、すぐにクイック開始/詳細を提示
  if (status === "waiting") {
    intents.push({ key: "quickStart", label: "クイック開始", palette: "orange", variant: "solid" });
    intents.push({ key: "advancedMode", label: "詳細", palette: "gray", variant: "outline" });
  }
  // finished: show primary (もう一度)
  if (status === "finished" && hostPrimary) {
    intents.push({ key: "primary", label: hostPrimary.label, palette: "orange" });
  }

  if (status === "clue") {
    if (!topicSelected) {
      intents.push({ key: "quickStart", label: "クイック開始", palette: "orange", variant: "solid" });
      intents.push({ key: "advancedMode", label: "詳細", palette: "gray", variant: "outline" });
      return intents;
    }

    if (resolveMode === "sort-submit") {
      // 数字が割り当てられた全プレイヤーがproposalに含まれているかをチェック
      const canEval = proposal.length > 0 && proposal.length === assigned;
      intents.push({
        key: "evaluate",
        label: "並びを確定",
        palette: "teal",
        disabled: !canEval,
        reason: canEval ? undefined : "全員分のカードが揃っていません",
      });
    }
  }

  return intents;
}



