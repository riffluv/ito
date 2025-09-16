"use client";
import { useEffect, useRef } from "react";
import { db } from "@/lib/firebase/client";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { notify } from "@/components/ui/notify";

export default function RoomNotifyBridge({ roomId }: { roomId: string }) {
  const seenRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!db || !roomId) return;
    seenRef.current = null; // reset on room change

    const q = query(
      collection(db, "rooms", roomId, "events"),
      orderBy("createdAt", "asc"),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      // 初回は既存イベントを既読として登録するだけ
      if (!seenRef.current) {
        seenRef.current = new Set<string>();
        snap.forEach((d) => seenRef.current!.add(d.id));
        return;
      }
      // 以降は新規のみトースト表示
      snap.docChanges().forEach((change) => {
        if (change.type !== "added") return;
        const id = change.doc.id;
        if (seenRef.current!.has(id)) return;
        seenRef.current!.add(id);
        const data = change.doc.data() as any;
        if (data?.kind === "notify") {
          const type = (data.type as any) || "info";
          const title = data.title || "通知";
          const description = typeof data.description === "string" ? data.description : undefined;
          notify({ title, description, type });
        }
      });
    });
    return () => {
      try { unsub(); } catch {}
      seenRef.current = null;
    };
  }, [roomId]);

  return null;
}

