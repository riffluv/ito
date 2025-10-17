import { useEffect, useRef } from "react";
import type { User } from "firebase/auth";
import type { PlayerDoc } from "@/lib/types";
import { logInfo, logError } from "@/lib/utils/log";
import { PRESENCE_STALE_MS } from "@/lib/constants/presence";

interface UseHostPruningParams {
  isHost: boolean;
  uid: string | null;
  user: User | null;
  roomId: string;
  players: (PlayerDoc & { id: string })[];
  onlineUids: string[] | undefined;
  presenceReady: boolean;
}

/**
 * ⚡ PERFORMANCE: 80行のホストプルーニング処理をカスタムフック化
 * オフラインプレイヤーを自動的に削除する（ホストのみ）
 */
export function useHostPruning({
  isHost,
  uid,
  user,
  roomId,
  players,
  onlineUids,
  presenceReady,
}: UseHostPruningParams) {
  const pruneRef = useRef<{
    key: string;
    ts: number;
    inflight: boolean;
  } | null>(null);
  const offlineSinceRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!isHost) return;
    if (!uid || !user) return;
    if (!presenceReady) return;
    if (!Array.isArray(onlineUids)) return;
    if (onlineUids.length === 0) return;
    if (!players.length) return;

    const OFFLINE_GRACE_MS = Math.min(8_000, Math.floor(PRESENCE_STALE_MS / 2));
    const STALE_THRESHOLD_MS = PRESENCE_STALE_MS;
    const now = Date.now();
    const onlineSet = new Set(onlineUids);

    // クリーンアップ: オンラインに戻った、または既に削除されたプレイヤー
    for (const id of Array.from(offlineSinceRef.current.keys())) {
      if (id === uid) {
        offlineSinceRef.current.delete(id);
        continue;
      }
      if (onlineSet.has(id)) {
        offlineSinceRef.current.delete(id);
        continue;
      }
      if (!players.some((p) => p.id === id)) {
        offlineSinceRef.current.delete(id);
      }
    }

    const candidates = players.filter(
      (p) => p.id !== uid && !onlineSet.has(p.id)
    );
    if (candidates.length === 0) return;

    const readyIds: string[] = [];
    for (const p of candidates) {
      const existing = offlineSinceRef.current.get(p.id);
      if (!existing) {
        offlineSinceRef.current.set(p.id, now);
        continue;
      }
      const offlineDuration = now - existing;
      if (offlineDuration < OFFLINE_GRACE_MS) continue;
      if (offlineDuration < STALE_THRESHOLD_MS) continue;
      readyIds.push(p.id);
    }

    if (readyIds.length === 0) return;
    readyIds.sort();
    const key = readyIds.join(",");
    const entry = pruneRef.current;
    if (entry && entry.inflight) return;
    if (entry && entry.key === key && now - entry.ts < 30_000) return;
    pruneRef.current = { key, ts: now, inflight: true };

    (async () => {
      try {
        const token = await user.getIdToken().catch(() => null);
        if (!token) return;
        logInfo("room-page", "prune-request", {
          roomId,
          targets: readyIds,
          offlineSince: readyIds.map(
            (id) => offlineSinceRef.current.get(id) ?? null
          ),
        });
        await fetch(`/api/rooms/${roomId}/prune`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, callerUid: uid, targets: readyIds }),
        });
      } catch (error) {
        logError("room-page", "prune-offline", error);
      } finally {
        pruneRef.current = { key, ts: Date.now(), inflight: false };
        logInfo("room-page", "prune-complete", { roomId, targets: readyIds });
        readyIds.forEach((id) => offlineSinceRef.current.delete(id));
      }
    })();
  }, [isHost, uid, user, onlineUids, players, roomId, presenceReady]);
}
