import { useEffect, useRef, useState } from "react";

type JoinOrderedPlayer = {
  id: string;
};

export function usePlayerJoinOrderTracker(players: JoinOrderedPlayer[]) {
  const playerJoinOrderRef = useRef<Map<string, number>>(new Map());
  const joinCounterRef = useRef(0);
  const [joinVersion, setJoinVersion] = useState(0);

  useEffect(() => {
    let updated = false;
    for (const player of players) {
      if (!playerJoinOrderRef.current.has(player.id)) {
        playerJoinOrderRef.current.set(player.id, joinCounterRef.current++);
        updated = true;
      }
    }
    if (updated) {
      setJoinVersion((value) => value + 1);
    }
  }, [players]);

  return { playerJoinOrderRef, joinVersion };
}

