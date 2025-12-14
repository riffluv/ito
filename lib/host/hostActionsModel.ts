/**
 * Pure host action model.
 * Receives current room snapshot and players/onlineCount, returns
 * UI-agnostic host action intents (labels, states). No side effects here.
 */
import { calculateEffectiveActive } from "@/lib/utils/playerCount";
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
  /** trace-friendly reason code (e.g. "ui.preparing", "players.insufficient.1") */
  reason?: string;
  /** optional human-friendly hint (tooltip etc.) */
  hint?: string;
  payload?: Record<string, unknown>;
  palette?: "brand" | "orange" | "gray" | "teal";
  variant?: "solid" | "outline" | "ghost" | "subtle" | "soft" | "link";
  confirm?: {
    title: string;
    body?: string;
  };
};

// 型ガード関数を追加
function hasValidTopic(room: RoomDoc): boolean {
  return typeof room.topic === "string" && room.topic.length > 0;
}

function filterValidIds(
  input: ReadonlyArray<string | null | undefined> | undefined | null
): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0
  );
}

function getProposalArray(room: RoomDoc): string[] {
  const proposal = room.order?.proposal;
  if (!Array.isArray(proposal)) {
    return [];
  }
  return filterValidIds(proposal);
}

function getOrderList(room: RoomDoc): string[] {
  const list = room.order?.list;
  if (!Array.isArray(list)) {
    return [];
  }
  return filterValidIds(list);
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
  const uiPreparing =
    room.ui?.roundPreparing === true || room.ui?.revealPending === true;
  const topicSelected = hasValidTopic(room);
  const proposal = getProposalArray(room);
  // アクティブ人数: realtime presence 集計があればそれを、なければ players 配列長
  const effectiveActive = calculateEffectiveActive(_onlineCount, players.length);
  const enoughPlayers = effectiveActive >= 2; // 最低2人

  const intents: HostIntent[] = [];

  // waiting: シンプルな「開始」「詳細」のみ
  if (status === "waiting") {
    // 初期UI要望: 「クイック開始」より単純な「開始」ラベルに変更
    const quickStartReason = uiPreparing
      ? "ui.preparing"
      : enoughPlayers
        ? undefined
        : `players.insufficient.${effectiveActive}`;
    const quickStartHint = uiPreparing
      ? "準備中です"
      : enoughPlayers
        ? undefined
        : `2人必要: 現在${effectiveActive}人`;
    intents.push({
      key: "quickStart",
      label: "開始",
      palette: "orange",
      variant: "solid",
      disabled: uiPreparing || !enoughPlayers,
      reason: quickStartReason,
      hint: quickStartHint,
    });
    intents.push({
      key: "advancedMode",
      label: "詳細",
      palette: "gray",
      variant: "outline",
      disabled: uiPreparing,
      reason: uiPreparing ? "ui.preparing" : undefined,
      hint: uiPreparing ? "準備中です" : undefined,
    });
  }
  // finished: show primary (もう一度)
  if (status === "finished" && hostPrimary) {
    intents.push({
      key: "primary",
      label: hostPrimary.label,
      palette: "orange",
      disabled: uiPreparing,
      reason: uiPreparing ? "ui.preparing" : undefined,
      hint: uiPreparing ? "準備中です" : undefined,
    });
  }

  if (status === "clue") {
    // 詳細設定ボタン（お題未選択時/選択済みどちらでも表示）
    intents.push({
      key: "advancedMode",
      label: "詳細",
      palette: "gray",
      variant: "outline",
      disabled: uiPreparing,
      reason: uiPreparing ? "ui.preparing" : undefined,
      hint: uiPreparing ? "準備中です" : undefined,
    });

    // ゲーム中断・リセットボタン
    intents.push({
      key: "reset",
      label: "中断",
      palette: "gray",
      variant: "ghost",
      disabled: uiPreparing,
      reason: uiPreparing ? "ui.preparing" : undefined,
      hint: uiPreparing ? "準備中です" : undefined,
      confirm: {
        title: "ゲームを中断しますか?",
        body: "現在の進行状況は失われ、待機状態に戻ります。よろしいですか?",
      },
    });

    if (resolveMode === "sort-submit" && topicSelected) {
      const orderList = getOrderList(room);
      const placedCount =
        proposal.length > 0 ? proposal.length : orderList.length;
      // evaluate 有効条件: 2人以上が場に出し、全アクティブ（effectiveActive）分が揃っている
      const canEval = placedCount >= 2 && placedCount === effectiveActive;
      let hint: string | undefined;
      let disabledReason: string | undefined;
      if (!canEval) {
        if (placedCount === 0) {
          disabledReason = "evaluate.empty";
          hint = "カードがまだ場に出ていません";
        } else if (placedCount < effectiveActive) {
          disabledReason = `evaluate.remaining.${effectiveActive - placedCount}`;
          hint = `残り${effectiveActive - placedCount}人`; // 進捗表示
        } else if (placedCount < 2) {
          disabledReason = "evaluate.insufficient";
          hint = "2人以上必要です";
        } else {
          disabledReason = "evaluate.incomplete";
        }
      }
      intents.push({
        key: "evaluate",
        label: "並びを確定",
        palette: "teal",
        disabled: uiPreparing || !canEval,
        reason: uiPreparing ? "ui.preparing" : disabledReason,
        hint: uiPreparing ? "準備中です" : hint,
      });
    }
  }

  return intents;
}



