// アバター配列（参加順で配布）
export const AVATAR_LIST = [
  "/avatars/knight1.webp",
  "/avatars/knightwomen1.webp",
  "/avatars/kenja.webp",
  "/avatars/kenshi.webp",
  "/avatars/mahou.webp",
  "/avatars/siifu.webp",
  "/avatars/arrow.webp",
  "/avatars/guitar.webp",
  "/avatars/ankoku.webp"
];

// 参加順でアバターを取得（重複なし）
export function getAvatarByOrder(playerCount: number): string {
  return AVATAR_LIST[playerCount % AVATAR_LIST.length];
}

// 既存の名前ベースアバター（後方互換性のため残す）
export function randomAvatar(name: string): string {
  const idx = Math.abs(hashCode(name)) % AVATAR_LIST.length;
  return AVATAR_LIST[idx];
}

export function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

export function range(n: number): number[] { return Array.from({ length: n }, (_, i) => i); }

// 入室順でプレイヤーIDをソートする関数
export function sortPlayersByJoinOrder(
  playerIds: string[],
  players: Array<{ id: string; lastSeen?: any }>
): string[] {
  const playerMap = new Map(players.map(p => [p.id, p]));

  return [...playerIds].sort((a, b) => {
    const playerA = playerMap.get(a);
    const playerB = playerMap.get(b);

    // lastSeenが存在しない場合は元の順序を維持
    if (!playerA?.lastSeen || !playerB?.lastSeen) {
      return playerIds.indexOf(a) - playerIds.indexOf(b);
    }

    // Timestamp型の比較（Firestore serverTimestamp）
    const timeA = playerA.lastSeen?.seconds || 0;
    const timeB = playerB.lastSeen?.seconds || 0;

    // 入室順（早い順）でソート
    return timeA - timeB;
  });
}

