"use client";
import { useEffect, useRef } from "react";
import { db } from "@/lib/firebase/client";
import { collection, onSnapshot, orderBy, query, limitToLast, Timestamp } from "firebase/firestore";
import { notify } from "@/components/ui/notify";
import { toastIds } from "@/lib/ui/toastIds";

export default function RoomNotifyBridge({ roomId }: { roomId: string }) {
  const seenRef = useRef<Set<string> | null>(null);
  const initLatestRef = useRef<Timestamp | null>(null);
  const unsubRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    if (!db || !roomId) return () => {};
    seenRef.current = null; // reset on room change
    initLatestRef.current = null;

    const start = () => {
      if (unsubRef.current) return;
      const q = query(
        collection(db!, "rooms", roomId, "events"),
        orderBy("createdAt", "asc"),
        // 初期読み取り最小化: 最新1件のみ
        limitToLast(1)
      );
      unsubRef.current = onSnapshot(q, (snap) => {
        // 初回は既存イベントを既読として登録するだけ
        if (!seenRef.current) {
          seenRef.current = new Set<string>();
          let latest: Timestamp | null = null;
          snap.forEach((d) => {
        seenRef.current!.add(d.id);
            const data = d.data() as { createdAt?: Timestamp | null };
            const c = data?.createdAt ?? null;
            if (c && (!latest || c.toMillis() > latest.toMillis())) latest = c;
          });
          initLatestRef.current = latest;
          return;
        }
        // 以降は新規のみトースト表示
        snap.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          const id = change.doc.id;
          if (seenRef.current!.has(id)) return;
          seenRef.current!.add(id);
          const data = change.doc.data() as {
            kind?: string;
            createdAt?: Timestamp;
            type?: string;
            title?: string;
            description?: unknown;
            toastId?: string;
          };
          if (data?.kind === "notify") {
            const createdAt: Timestamp | undefined = data?.createdAt;
            const initLatest = initLatestRef.current;
            // 初回スナップショット時点以降のものだけを表示
            if (initLatest && createdAt && createdAt.toMillis() <= initLatest.toMillis()) {
              return;
            }
            const rawType = typeof data.type === "string" ? data.type : undefined;
            const type: "info" | "warning" | "success" | "error" =
              rawType === "info" || rawType === "warning" || rawType === "success" || rawType === "error"
                ? rawType
                : "info";
            const title = data.title || "通知";
            const description = typeof data.description === "string" ? data.description : undefined;
            const toastId = (() => {
              const raw = title.replace(/\s+/g, "");
              if (!raw) return data.toastId;
              if (raw.includes("シャッフル")) return toastIds.topicShuffleSuccess(roomId);
              if (raw.includes("お題変更") || raw.includes("お題を変更")) return toastIds.topicChangeSuccess(roomId);
              if (raw.includes("数字") && raw.includes("配")) return toastIds.numberDealSuccess(roomId);
              if (raw.includes("リセット")) return toastIds.gameReset(roomId);
              if (raw.includes("開始")) return toastIds.gameStart(roomId);
              return data.toastId;
            })();
            notify({ id: toastId || change.doc.id, title, description, type });
            // 表示したイベントの時刻を保持し、連続追加でも二重表示しない
            if (createdAt && (!initLatest || createdAt.toMillis() > initLatest.toMillis())) {
              initLatestRef.current = createdAt;
            }
          }
        });
      });
    };

    const stop = () => {
      if (unsubRef.current) {
        try {
          unsubRef.current();
        } catch {
          // noop
        }
        unsubRef.current = null;
      }
    };

    // 可視時のみ購読（読み取り削減）
    const onVis = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") start();
      else stop();
    };
    if (typeof document === "undefined" || document.visibilityState === "visible") start();
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVis);

    return () => {
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVis);
      stop();
      seenRef.current = null;
      initLatestRef.current = null;
    };
  }, [roomId]);

  return null;
}
