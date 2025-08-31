/**
 * Pure host action model.
 * Receives current room snapshot and players/onlineCount, returns
 * UI-agnostic host action intents (labels, states). No side effects here.
 */
import type { PlayerDoc, RoomDoc } from "@/lib/types";

export type HostIntentKey =
  | "primary"
  | "quickStart"
  | "advancedMode"
  | "evaluate"
  | "reset";

export type HostIntent = {
  key: HostIntentKey;
  label: string;
  disabled?: boolean;
  reason?: string;
  payload?: Record<string, unknown>;
  palette?: "brand" | "orange" | "gray" | "teal";
  variant?: "solid" | "outline" | "ghost" | "subtle" | "soft" | "link";
};

// 型ガード関数を追加
function hasValidTopic(room: RoomDoc): boolean {
  return typeof room.topic === 'string' && room.topic.length > 0;
}

function getProposalArray(room: RoomDoc): string[] {
  return room.order?.proposal ? [...room.order.proposal] : [];
}

function getOrderList(room: RoomDoc): string[] {
  return room.order?.list ? [...room.order.list] : [];
}

export function buildHostActionModel(
  room: RoomDoc & { id?: string },
  players: (PlayerDoc & { id: string })[],
  _onlineCount: number | undefined,
  _topicTypeLabels: readonly string[],
  hostPrimary: { label: string } | null
): HostIntent[] {
  const status = room.status;
  const resolveMode = room.options?.resolveMode;
  const topicSelected = hasValidTopic(room);
  const proposal = getProposalArray(room);
  const assigned = players.filter(
    (p) => typeof p.number === "number"
  ).length;
  // アクティブ人数: realtime presence 集計があればそれを、なければ players 配列長
  const effectiveActive =
    typeof _onlineCount === "number" ? _onlineCount : players.length;
  const enoughPlayers = effectiveActive >= 2; // 最低2人

  const intents: HostIntent[] = [];

  // waiting: シンプルな「開始」「詳細」のみ
  if (status === "waiting") {
    // 初期UI要望: 「クイック開始」より単純な「開始」ラベルに変更
    intents.push({
      key: "quickStart",
      label: "開始",
      palette: "orange",
      variant: "solid",
      disabled: !enoughPlayers,
      reason: enoughPlayers ? undefined : `2人必要: 現在${effectiveActive}人`,
    });
    intents.push({
      key: "advancedMode",
      label: "詳細",
      palette: "gray",
      variant: "outline",
    });
  }
  // finished: show primary (もう一度)
  if (status === "finished" && hostPrimary) {
    intents.push({
      key: "primary",
      label: hostPrimary.label,
      palette: "orange",
    });
  }

  if (status === "clue") {
    // 詳細設定ボタン（お題未選択時/選択済みどちらでも表示）
    intents.push({
      key: "advancedMode",
      label: "詳細",
      palette: "gray",
      variant: "outline",
    });

    // ゲーム中断・リセットボタン
    intents.push({
      key: "reset",
      label: "中断",
      palette: "gray",
      variant: "ghost",
    });

    if (resolveMode === "sort-submit" && topicSelected) {
      const orderList = getOrderList(room);
      const placedCount =
        proposal.length > 0 ? proposal.length : orderList.length;
      // evaluate 有効条件: 2人以上が場に出し、全アクティブ（effectiveActive）分が揃っている
      const canEval = placedCount >= 2 && placedCount === effectiveActive;
      let reason: string | undefined;
      if (!canEval) {
        if (placedCount === 0) reason = "カードがまだ場に出ていません";
        else if (placedCount < effectiveActive)
          reason = `残り${effectiveActive - placedCount}人`; // 進捗表示
        else if (placedCount < 2) reason = "2人以上必要です";
      }
      intents.push({
        key: "evaluate",
        label: "並びを確定",
        palette: "teal",
        disabled: !canEval,
        reason,
      });
    }
  }

  return intents;
}
