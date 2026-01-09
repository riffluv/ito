import { db, firebaseEnabled } from "@/lib/firebase/client";
import { playerConverter } from "@/lib/firebase/converters";
import type { PlayerDoc } from "@/lib/types";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import { bumpMetric, setMetric } from "@/lib/utils/metrics";
import { scheduleIdleTask } from "@/lib/utils/idleScheduler";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  type FirestoreError,
} from "firebase/firestore";
import type { Dispatch, SetStateAction } from "react";
import { unstable_batchedUpdates } from "react-dom";

import { createPlayersSignature } from "@/lib/hooks/participants/createPlayersSignature";

export function subscribePlayersFirestore(params: {
  roomId: string;
  uid: string | null;
  setPlayers: Dispatch<SetStateAction<(PlayerDoc & { id: string })[]>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<Error | null>>;
  playersRef: { current: (PlayerDoc & { id: string })[] };
  playersSignatureRef: { current: string };
}): () => void {
  const {
    roomId,
    uid,
    setPlayers,
    setLoading,
    setError,
    playersRef,
    playersSignatureRef,
  } = params;

  const unsubRef = { current: null as null | (() => void) };
  const backoffUntilRef = { current: 0 };
  let backoffTimer: ReturnType<typeof setTimeout> | null = null;

  const visibilityCleanupRef = { current: null as null | (() => void) };
  let startVisibilityCleanup: null | (() => void) = null;
  let cancelIdleStart: (() => void) | null = null;

  const detachVisibilityListener = () => {
    if (typeof document === "undefined") return;
    if (visibilityCleanupRef.current) {
      visibilityCleanupRef.current();
      visibilityCleanupRef.current = null;
    }
  };

  const detachStartVisibility = () => {
    startVisibilityCleanup?.();
    startVisibilityCleanup = null;
  };

  const stop = () => {
    try {
      unsubRef.current?.();
    } catch {}
    unsubRef.current = null;
    detachVisibilityListener();
  };

  const cleanup = () => {
    if (backoffTimer) {
      try {
        clearTimeout(backoffTimer);
      } catch {}
    }
    stop();
    detachVisibilityListener();
    detachStartVisibility();
    cancelIdleStart?.();
  };

  if (!firebaseEnabled || !roomId) {
    unstable_batchedUpdates(() => {
      setPlayers([]);
      playersRef.current = [];
      playersSignatureRef.current = "";
      setError(null);
      setLoading(false);
    });
    return cleanup;
  }

  // auth 未確定のタイミングで購読すると permission-denied で購読が死ぬ可能性があるため、
  // uid が確定してから購読を開始する。
  if (!uid) {
    unstable_batchedUpdates(() => {
      setPlayers([]);
      playersRef.current = [];
      playersSignatureRef.current = "";
      setError(null);
      setLoading(true);
    });
    return cleanup;
  }

  setLoading(true);
  setError(null);

  const applyPlayersSnapshot = (
    docs: Array<{ data: () => PlayerDoc; id: string }>
  ) => {
    const working = docs.map((doc) => ({
      ...(doc.data() as PlayerDoc),
      id: doc.id,
    }));
    const signature = createPlayersSignature(working);
    const previousSignature = playersSignatureRef.current;
    const shouldUpdatePlayers = signature !== previousSignature;
    if (shouldUpdatePlayers) {
      playersRef.current = working;
      playersSignatureRef.current = signature;
    }
    unstable_batchedUpdates(() => {
      if (shouldUpdatePlayers) {
        setPlayers(working);
      }
      setLoading(false);
    });
    setMetric("participants", "lastSnapshotTs", Date.now());
    setMetric("participants", "playersCount", working.length);
  };

  const maybeStart = () => {
    if (unsubRef.current) return;
    const now = Date.now();
    if (now < backoffUntilRef.current) return;
    bumpMetric("participants", "subscribeAttempts");
    unsubRef.current = onSnapshot(
      query(
        collection(db!, "rooms", roomId, "players").withConverter(playerConverter),
        orderBy("uid", "asc")
      ),
      (snap) => {
        const changes = snap.docChanges();
        let working =
          playersRef.current.length > 0 ? playersRef.current.slice() : [];

        // 初回スナップショットなど、全件 added の場合は一度リストを作り直す
        const fullReset =
          !snap.metadata.hasPendingWrites &&
          changes.length > 0 &&
          changes.length === snap.size;

        if (fullReset || (changes.length === 0 && !snap.metadata.hasPendingWrites)) {
          working = snap.docs.map((doc) => ({
            ...(doc.data() as PlayerDoc),
            id: doc.id,
          }));
        } else {
          for (const change of changes) {
            const payload = {
              ...(change.doc.data() as PlayerDoc),
              id: change.doc.id,
            };
            if (change.type === "added") {
              const index = change.newIndex >= 0 ? change.newIndex : working.length;
              working.splice(index, 0, payload);
            } else if (change.type === "modified") {
              const oldIndex =
                change.oldIndex >= 0
                  ? change.oldIndex
                  : working.findIndex((p) => p.id === payload.id);
              if (oldIndex >= 0) {
                working.splice(oldIndex, 1);
              }
              const newIndex = change.newIndex >= 0 ? change.newIndex : working.length;
              working.splice(newIndex, 0, payload);
            } else if (change.type === "removed") {
              const removeIndex =
                change.oldIndex >= 0
                  ? change.oldIndex
                  : working.findIndex((p) => p.id === payload.id);
              if (removeIndex >= 0) {
                working.splice(removeIndex, 1);
              }
            }
          }
        }

        const signature = createPlayersSignature(working);
        const previousSignature = playersSignatureRef.current;
        const shouldUpdatePlayers = signature !== previousSignature;
        if (shouldUpdatePlayers) {
          playersRef.current = working;
          playersSignatureRef.current = signature;
        }

        unstable_batchedUpdates(() => {
          if (shouldUpdatePlayers) {
            setPlayers(working);
          }
          setLoading(false);
        });
        setMetric("participants", "lastSnapshotTs", Date.now());
        setMetric("participants", "playersCount", working.length);
      },
      (err: FirestoreError) => {
        unstable_batchedUpdates(() => {
          setError(err);
          setLoading(false);
        });
        if (isFirebaseQuotaExceeded(err)) {
          handleFirebaseQuotaError("プレイヤー購読");
          backoffUntilRef.current = Date.now() + 5 * 60 * 1000; // 5分停止
          stop();
          if (backoffTimer) {
            try {
              clearTimeout(backoffTimer);
            } catch {}
            backoffTimer = null;
          }
          bumpMetric("participants", "quotaExceeded");
          const resume = () => {
            if (typeof document !== "undefined" && document.visibilityState !== "visible") {
              if (typeof document !== "undefined" && !visibilityCleanupRef.current) {
                const handler = () => {
                  if (document.visibilityState === "visible") {
                    detachVisibilityListener();
                    resume();
                  }
                };
                document.addEventListener("visibilitychange", handler);
                visibilityCleanupRef.current = () => {
                  document.removeEventListener("visibilitychange", handler);
                };
                bumpMetric("participants", "visibilityAwait");
              }
              return;
            }
            detachVisibilityListener();
            const remain = backoffUntilRef.current - Date.now();
            if (remain > 0) {
              backoffTimer = setTimeout(resume, Math.min(remain, 30_000));
            } else {
              maybeStart();
            }
          };
          bumpMetric("participants", "resumeScheduled");
          resume();
        }
      }
    );
  };

  const startWithVisibilityGate = () => {
    detachStartVisibility();
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      const handler = () => {
        if (document.visibilityState === "visible") {
          document.removeEventListener("visibilitychange", handler);
          startVisibilityCleanup = null;
          void (async () => {
            try {
              const snap = await getDocs(
                query(
                  collection(db!, "rooms", roomId, "players").withConverter(playerConverter),
                  orderBy("uid", "asc")
                )
              );
              applyPlayersSnapshot(
                snap.docs as unknown as Array<{ data: () => PlayerDoc; id: string }>
              );
            } catch {}
            maybeStart();
          })();
        }
      };
      document.addEventListener("visibilitychange", handler);
      startVisibilityCleanup = () =>
        document.removeEventListener("visibilitychange", handler);
      return;
    }

    void (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db!, "rooms", roomId, "players").withConverter(playerConverter),
            orderBy("uid", "asc")
          )
        );
        applyPlayersSnapshot(
          snap.docs as unknown as Array<{ data: () => PlayerDoc; id: string }>
        );
      } catch {}
      maybeStart();
    })();
  };

  const idleDelayMs = process.env.NEXT_PUBLIC_PERF_WARMUP === "1" ? 60 : 28;
  cancelIdleStart = scheduleIdleTask(
    () => {
      try {
        startWithVisibilityGate();
      } catch {}
    },
    { delayMs: idleDelayMs, timeoutMs: 180 }
  );

  return cleanup;
}
