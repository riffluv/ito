import type { PartyMember } from "@/components/ui/PartyMemberCard";

export type DragonQuestPartyProps = {
  players: PartyMember[];
  roomStatus: string;
  onlineCount?: number; // 実際のオンライン参加者数
  onlineUids?: string[]; // オンライン参加者の id 列
  hostId?: string; // ホストのUID
  roomId?: string; // 手動委譲用
  isHostUser?: boolean; // 自分がホストか
  eligibleIds?: string[]; // ラウンド対象（オンライン）
  roundIds?: string[]; // 今ラウンドの全対象（オフライン含む）
  submittedPlayerIds?: string[]; // 「提出済み」扱いにするプレイヤーID
  fallbackNames?: Record<string, string>;
  displayRoomName?: string; // ルーム名表示用
  suspendTransientUpdates?: boolean;
};

export function shallowEqualPartyMember(a: PartyMember, b: PartyMember) {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

function areStringArraysEqual(prev: string[] | undefined, next: string[] | undefined) {
  if (prev === next) return true;
  if (!prev || !next)
    return (!prev || prev.length === 0) && (!next || next.length === 0);
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (prev[i] !== next[i]) {
      return false;
    }
  }
  return true;
}

function arePartyMembersEqual(prev: PartyMember[], next: PartyMember[]) {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (!shallowEqualPartyMember(prev[i], next[i])) {
      return false;
    }
  }
  return true;
}

function areFallbackNamesEqual(
  prev: Record<string, string> | undefined,
  next: Record<string, string> | undefined
) {
  if (prev === next) return true;
  if (!prev && !next) return true;
  if (!prev || !next) return false;
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return false;
  for (const key of prevKeys) {
    if (prev[key] !== next[key]) {
      return false;
    }
  }
  return true;
}

export function areDragonQuestPartyPropsEqual(
  prev: DragonQuestPartyProps,
  next: DragonQuestPartyProps
) {
  if (!arePartyMembersEqual(prev.players, next.players)) return false;
  if (prev.roomStatus !== next.roomStatus) return false;
  if ((prev.onlineCount ?? null) !== (next.onlineCount ?? null)) return false;
  if (!areStringArraysEqual(prev.onlineUids, next.onlineUids)) return false;
  if (prev.hostId !== next.hostId) return false;
  if (prev.roomId !== next.roomId) return false;
  if ((prev.isHostUser ?? false) !== (next.isHostUser ?? false)) return false;
  if (!areStringArraysEqual(prev.eligibleIds, next.eligibleIds)) return false;
  if (!areStringArraysEqual(prev.roundIds, next.roundIds)) return false;
  if (!areStringArraysEqual(prev.submittedPlayerIds, next.submittedPlayerIds))
    return false;
  if (!areFallbackNamesEqual(prev.fallbackNames, next.fallbackNames)) return false;
  if ((prev.displayRoomName ?? "") !== (next.displayRoomName ?? "")) return false;
  if ((prev.suspendTransientUpdates ?? false) !== (next.suspendTransientUpdates ?? false))
    return false;
  return true;
}

