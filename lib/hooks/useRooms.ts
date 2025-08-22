"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { RoomDoc } from "@/lib/types";
import { roomConverter } from "@/lib/firebase/converters";

export type UseRoomsResult = {
  rooms: (RoomDoc & { id: string })[];
  loading: boolean;
  error: Error | null;
};

export function useRooms(enabled: boolean): UseRoomsResult {
  const [rooms, setRooms] = useState<(RoomDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRooms([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const q = query(
      collection(db!, "rooms").withConverter(roomConverter),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: (RoomDoc & { id: string })[] = [];
        snap.forEach((d) => list.push(d.data() as any));
        setRooms(list);
        setLoading(false);
      },
      (err) => {
        setError(err as any);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [enabled]);

  return useMemo(() => ({ rooms, loading, error }), [rooms, loading, error]);
}
