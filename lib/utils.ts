import type { FieldValue, Timestamp } from "firebase/firestore";

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
  "/avatars/ankoku.webp",
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

export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

type TimestampInput =
  | number
  | { seconds?: number | undefined }
  | { toMillis?: () => number | undefined }
  | Timestamp
  | FieldValue
  | null
  | undefined;

const hasSeconds = (value: unknown): value is { seconds?: number } =>
  typeof value === "object" && value !== null && typeof (value as { seconds?: number }).seconds === "number";

const hasToMillis = (value: unknown): value is { toMillis?: () => number } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { toMillis?: () => number }).toMillis === "function";

function toSeconds(value: TimestampInput): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (hasSeconds(value) && typeof value.seconds === "number") {
    return value.seconds;
  }
  if (hasToMillis(value) && typeof value.toMillis === "function") {
    try {
      return Math.floor((value.toMillis() ?? 0) / 1000);
    } catch {
      return null;
    }
  }
  return null;
}

// 入室順でプレイヤーIDをソートする関数
export function sortPlayersByJoinOrder(
  playerIds: string[],
  players: Array<{
    id: string;
    lastSeen?: TimestampInput;
    joinedAt?: TimestampInput;
  }>
): string[] {
  const playerMap = new Map(players.map((p) => [p.id, p] as const));

  return [...playerIds].sort((a, b) => {
    const playerA = playerMap.get(a);
    const playerB = playerMap.get(b);

    const joinedA = toSeconds(playerA?.joinedAt);
    const joinedB = toSeconds(playerB?.joinedAt);
    if (joinedA !== null && joinedB !== null && joinedA !== joinedB) {
      return joinedA - joinedB;
    }

    const lastSeenA = toSeconds(playerA?.lastSeen);
    const lastSeenB = toSeconds(playerB?.lastSeen);
    if (lastSeenA !== null && lastSeenB !== null && lastSeenA !== lastSeenB) {
      return lastSeenA - lastSeenB;
    }

    return playerIds.indexOf(a) - playerIds.indexOf(b);
  });
}
