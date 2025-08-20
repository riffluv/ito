"use client";
import { useEffect, useMemo, useState } from "react";
import { off, onValue, ref } from "firebase/database";
import { collection, onSnapshot } from "firebase/firestore";
import { rtdb, db, firebaseEnabled } from "@/lib/firebase/client";
import { ACTIVE_WINDOW_MS, isActive } from "@/lib/time";
import { presenceSupported } from "@/lib/firebase/presence";

export function useLobbyCounts(roomIds: string[]) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  // roomIds キー以外の値をクリーンに保つ
  const roomKey = useMemo(() => roomIds.slice().sort().join(","), [roomIds]);
  useEffect(() => {
    setCounts((prev) => {
      const next: Record<string, number> = {};
      for (const id of roomIds) next[id] = prev[id] ?? 0;
      return next;
    });
  }, [roomKey]);

  useEffect(() => {
    if (!firebaseEnabled) return;
    if (roomIds.length === 0) {
      setCounts({});
      return;
    }

    // RTDB presence を部屋ごとに購読（ルール互換性のため /presence/$roomId を読む）
    if (presenceSupported()) {
      const offs = roomIds.map((id) => {
        const roomRef = ref(rtdb!, `presence/${id}`);
        const handler = (snap: any) => {
          const users = (snap.val() || {}) as Record<string, Record<string, any>>; // uid -> connId -> {}
          let n = 0;
          for (const uid of Object.keys(users)) {
            const conns = users[uid] || {};
            if (Object.keys(conns).length > 0) n += 1;
          }
          setCounts((prev) => ({ ...prev, [id]: n }));
        };
        const onErr = () => setCounts((prev) => ({ ...prev, [id]: 0 }));
        onValue(roomRef, handler, onErr as any);
        return () => off(roomRef, "value", handler);
      });
      return () => offs.forEach((fn) => fn());
    }

    // フォールバック: Firestore の lastSeen を使用
    const unsubs = roomIds.map((id) =>
      onSnapshot(collection(db, "rooms", id, "players"), (snap) => {
        const now = Date.now();
        const seen = new Set<string>();
        let active = 0;
        snap.forEach((d) => {
          const data: any = d.data();
          const uid: string | undefined = data?.uid;
          if (uid && seen.has(uid)) return;
          if (isActive(data?.lastSeen, now, ACTIVE_WINDOW_MS)) {
            active += 1;
            if (uid) seen.add(uid);
          }
        });
        setCounts((prev) => ({ ...prev, [id]: active }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [firebaseEnabled, roomKey]);

  return counts;
}
