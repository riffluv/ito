import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, type DocumentData } from "firebase/firestore";

import { db, firebaseEnabled } from "@/lib/firebase/client";
import { traceError } from "@/lib/utils/trace";

import type { SpectatorRejoinSource, SpectatorSessionMode } from "./types";

const SESSION_COLLECTION = "spectatorSessions";

const toMillis = (value: unknown): number | null => {
  if (typeof value === "number") return value;
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    try {
      return Number((value as { toMillis: () => number }).toMillis());
    } catch {
      return null;
    }
  }
  return null;
};

export type SpectatorHostRequest = {
  sessionId: string;
  viewerUid: string | null;
  inviteId: string | null;
  mode: SpectatorSessionMode | null;
  source: SpectatorRejoinSource;
  requestedAt: number | null;
  flags: Record<string, unknown> | null;
};

type SpectatorHostQueueState = {
  requests: SpectatorHostRequest[];
  loading: boolean;
  error: string | null;
};

type UseSpectatorHostQueueOptions = {
  enabled?: boolean;
};

const INITIAL_STATE: SpectatorHostQueueState = {
  requests: [],
  loading: true,
  error: null,
};

const mapDocument = (doc: DocumentData): SpectatorHostRequest | null => {
  const data = doc as Record<string, unknown>;
  const rejoin = data.rejoinRequest as Record<string, unknown> | null | undefined;
  if (!rejoin || rejoin.status !== "pending") {
    return null;
  }
  const sourceRaw = typeof rejoin.source === "string" ? rejoin.source : "manual";
  const source: SpectatorRejoinSource = sourceRaw === "auto" ? "auto" : "manual";
  const requestedAt = toMillis(rejoin.createdAt);
  const viewerUid =
    typeof data.viewerUid === "string" && data.viewerUid.length > 0 ? (data.viewerUid as string) : null;
  const inviteId =
    typeof data.inviteId === "string" && data.inviteId.length > 0 ? (data.inviteId as string) : null;
  const mode =
    data.mode === "public" || data.mode === "private" ? (data.mode as SpectatorSessionMode) : null;
  const flags =
    data.flags && typeof data.flags === "object" ? (data.flags as Record<string, unknown>) : null;

  return {
    sessionId: typeof data.id === "string" && data.id.length > 0 ? (data.id as string) : doc.id,
    viewerUid,
    inviteId,
    mode,
    source,
    requestedAt,
    flags,
  };
};

export function useSpectatorHostQueue(
  roomId: string | null | undefined,
  options?: UseSpectatorHostQueueOptions
) {
  const [state, setState] = useState<SpectatorHostQueueState>(INITIAL_STATE);
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    const noopCleanup = () => {};
    if (!enabled) {
      setState({ requests: [], loading: false, error: null });
      return noopCleanup;
    }
    if (!roomId || !firebaseEnabled || !db) {
      setState({
        requests: [],
        loading: false,
        error: firebaseEnabled ? null : "firebase-disabled",
      });
      return noopCleanup;
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    const unsubscribe = (() => {
      try {
        const collectionRef = collection(db, SESSION_COLLECTION);
        const q = query(collectionRef, where("roomId", "==", roomId));
        return onSnapshot(
          q,
          (snapshot) => {
            const next: SpectatorHostRequest[] = [];
            snapshot.forEach((docSnap) => {
              const mapped = mapDocument({ id: docSnap.id, ...docSnap.data() });
              if (mapped) {
                next.push(mapped);
              }
            });
            next.sort((a, b) => (a.requestedAt ?? 0) - (b.requestedAt ?? 0));
            setState({
              requests: next,
              loading: false,
              error: null,
            });
          },
          (error) => {
            traceError("spectatorV2.host.queue", error, { roomId });
            setState({
              requests: [],
              loading: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        );
      } catch (error) {
        traceError("spectatorV2.host.queue.setup", error, { roomId });
        return null;
      }
    })();

    if (!unsubscribe) {
      return noopCleanup;
    }
    return () => {
      unsubscribe();
    };
  }, [roomId, enabled]);

  return {
    requests: state.requests,
    loading: state.loading,
    error: state.error,
    hasPending: state.requests.length > 0,
  };
}
