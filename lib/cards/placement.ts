import type { PlayerDoc } from "@/lib/types";

/**
 * カード配置とプレイヤー状態管理のユーティリティ関数群
 * CentralCardBoard.tsxから抽出した純粋関数
 */

interface RawPlayer {
  id?: string;
  uid?: string;
  [key: string]: unknown;
}

/**
 * プレイヤー配列からIDによる高速ルックアップMapを作成
 * @param players プレイヤー配列
 * @returns プレイヤーID -> PlayerDocのMap
 */
export function createPlayerMap(
  players: RawPlayer[]
): Map<string, PlayerDoc & { id: string }> {
  const map = new Map<string, PlayerDoc & { id: string }>();
  players.forEach((player) => {
    const playerId = player?.id || player?.uid;
    if (player && playerId) {
      map.set(
        playerId,
        {
          ...(player as PlayerDoc),
          id: playerId,
        }
      );
    }
  });
  return map;
}

/**
 * 配置済みIDセットを作成（確定 + 提案状態）
 * @param orderList 確定順序
 * @param proposal 提案配列（sort-submit用）
 * @returns 配置済みIDのSet
 */
export function createPlacedIds(
  orderList?: string[],
  proposal?: string[]
): Set<string> {
  return new Set<string>([...(orderList || []), ...(proposal || [])]);
}

/**
 * 待機中のプレイヤーリストを作成
 * @param eligibleIds 対象プレイヤーID配列
 * @param playerMap プレイヤーマップ
 * @param placedIds 配置済みIDセット
 * @returns 待機中プレイヤー配列
 */
export function createWaitingPlayers(
  eligibleIds: string[],
  playerMap: Map<string, PlayerDoc & { id: string }>,
  placedIds: Set<string>
): (PlayerDoc & { id: string })[] {
  return (eligibleIds || [])
    .map((id) => playerMap.get(id)!)
    .filter((p) => p && !placedIds.has(p.id));
}

/**
 * 現在場に見えているカード数を計算（確定 + pending）
 * @param orderList 確定順序
 * @param pending ローカルpending配列
 * @returns 視覚的な配置数
 */
export function calculateVisualCardCount(
  orderList?: string[],
  pending?: string[]
): number {
  const uniqueSet = new Set<string>();
  (orderList || []).forEach((id) => uniqueSet.add(id));
  (pending || []).forEach((id) => uniqueSet.add(id));
  return uniqueSet.size;
}

/**
 * 順次モードでの表示順序配列を構築（確定 + pending合成）
 * @param orderList 確定順序
 * @param pending ローカルpending配列
 * @returns 合成された順序付きID配列
 */
export function createSequentialOrder(
  orderList?: string[],
  pending?: string[]
): string[] {
  const sequence: string[] = [];
  (orderList || []).forEach((id) => {
    if (!sequence.includes(id)) sequence.push(id);
  });
  (pending || []).forEach((id) => {
    if (!sequence.includes(id)) sequence.push(id);
  });
  return sequence;
}
