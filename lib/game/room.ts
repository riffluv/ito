import { sendNotifyEvent } from "@/lib/firebase/events";
import { apiMutateProposal, apiCommitPlay, apiDealNumbers, apiContinueAfterFail, apiStartGame, apiSubmitOrder, apiFinalizeReveal } from "@/lib/services/roomApiClient";

// 乱数はクライアントで自分の番号計算に使用

// 通知ブロードキャスト関数
async function broadcastNotify(
  roomId: string,
  type: "info" | "warning" | "success" | "error",
  title: string,
  description?: string,
  contextKey?: string
) {
  try {
    await sendNotifyEvent(roomId, {
      type,
      title,
      description,
      dedupeKey: contextKey,
    });
  } catch {
    // ignore broadcast failure
  }
}

export type DealNumbersOptions = {
  skipPresence?: boolean;
};

export async function startGame(roomId: string) {
  await apiStartGame(roomId);
  try {
    await broadcastNotify(
      roomId,
      "success",
      "ゲームを開始しました",
      "連想ワードを入力してください",
      "room:start"
    );
  } catch {
    // ignore notify failure
  }
}

// ホストがトピック選択後に配札（重複なし）
export async function dealNumbers(
  roomId: string,
  _attempt = 0,
  options?: DealNumbersOptions
): Promise<number> {
  const skipPresence = options?.skipPresence === true;
  const result = await apiDealNumbers(roomId, { skipPresence });
  return result.count;
}

// finalizeOrder（公開順演出）は現行フローでは未使用

export async function continueAfterFail(roomId: string) {
  await apiContinueAfterFail(roomId);
}

// chooseAfterFail は不要（失敗後は自動継続または即終了）

// 並べ替え提案を保存（ルームの order.proposal に保存）
export type ProposalWriteResult = "ok" | "noop" | "missing-deal";

// sort-submit モード: プレイヤーが自分のカードを場(提案配列)に置く
// 既存の末尾追加機能（「出す」ボタン用）
export async function addCardToProposal(
  roomId: string,
  playerId: string
): Promise<ProposalWriteResult> {
  return addCardToProposalAtPosition(roomId, playerId, -1); // -1 = 末尾追加
}

// 新機能：位置指定でカード追加（WaitingCardドラッグ用）
export async function addCardToProposalAtPosition(
  roomId: string,
  playerId: string,
  targetIndex: number = -1
): Promise<ProposalWriteResult> {
  const res = await apiMutateProposal({ roomId, playerId, action: "add", targetIndex });
  return res.status;
}

export async function removeCardFromProposal(
  roomId: string,
  playerId: string
) {
  const res = await apiMutateProposal({ roomId, playerId, action: "remove" });
  return res.status;
}

export async function moveCardInProposalToPosition(
  roomId: string,
  playerId: string,
  targetIndex: number
) {
  const res = await apiMutateProposal({ roomId, playerId, action: "move", targetIndex });
  return res.status;
}

export async function commitPlayFromClue(roomId: string, playerId: string) {
  await apiCommitPlay(roomId, playerId);
}

export async function submitSortedOrder(roomId: string, list: string[]) {
  await apiSubmitOrder(roomId, list);
}

// reveal フェーズ完了後に最終確定 (UI のアニメーション完了イベントで呼ぶ)
export async function finalizeReveal(roomId: string) {
  await apiFinalizeReveal(roomId);
}

// Legacy exports for tests/utilities that consumed room.ts directly
export { selectDealTargetPlayers } from "@/lib/game/domain";
