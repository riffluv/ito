import { useCallback, useMemo } from "react";

type PlayerNameEntry = {
  id: string;
  name?: string | null;
};

type UseRoomDisplayNameHelpersParams = {
  players: PlayerNameEntry[];
  roomHostId: string | null;
  roomHostName: string | null;
  uid: string | null;
  displayName: string | null | undefined;
};

export function useRoomDisplayNameHelpers(params: UseRoomDisplayNameHelpersParams) {
  const { players, roomHostId, roomHostName, uid, displayName } = params;

  const normalizedDisplayName = useMemo(() => {
    if (typeof displayName === "string") {
      const trimmed = displayName.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return "匿名";
  }, [displayName]);

  const playerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const player of players) {
      map.set(player.id, player.name ?? "");
    }
    return map;
  }, [players]);

  const resolveSpectatorDisplayName = useCallback(
    (viewerUid: string | null) => {
      if (!viewerUid) return "観戦者";
      const name = playerNameById.get(viewerUid)?.trim();
      if (name && name.length > 0) {
        return name;
      }
      return `観戦者(${viewerUid.slice(0, 6)})`;
    },
    [playerNameById]
  );

  const playersSignature = useMemo(() => players.map((player) => player.id).join(","), [players]);

  const fallbackNames = useMemo(() => {
    const map: Record<string, string> = {};
    if (roomHostId && roomHostName) {
      map[roomHostId] = roomHostName;
    }
    const trimmedDisplayName = typeof displayName === "string" ? displayName.trim() : "";
    if (uid && trimmedDisplayName) {
      map[uid] = trimmedDisplayName;
    }
    return map;
  }, [roomHostId, roomHostName, uid, displayName]);

  return {
    normalizedDisplayName,
    resolveSpectatorDisplayName,
    playersSignature,
    fallbackNames,
  };
}

