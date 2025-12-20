"use client";

import { useEffect } from "react";

type SentryGlobal = {
  setTag?: (key: string, value: string) => void;
  setContext?: (key: string, context: Record<string, unknown>) => void;
  setUser?: (user: { id?: string | null }) => void;
};

type SentryRoomContextProps = {
  roomId: string;
  uid: string | null;
  phase: string;
  joinStatus: string;
  isHost: boolean;
  isMember: boolean;
  spectatorStatus?: string | null;
  presenceReady: boolean;
  presenceDegraded: boolean;
  syncHealth?: string | null;
};

function getSentryGlobal(): SentryGlobal | null {
  const globalScope = globalThis as typeof globalThis & { Sentry?: SentryGlobal };
  return globalScope.Sentry ?? null;
}

export default function SentryRoomContext({
  roomId,
  uid,
  phase,
  joinStatus,
  isHost,
  isMember,
  spectatorStatus,
  presenceReady,
  presenceDegraded,
  syncHealth,
}: SentryRoomContextProps) {
  useEffect(() => {
    const sentry = getSentryGlobal();
    if (!sentry) return;
    try {
      sentry.setUser?.(uid ? { id: uid } : {});
    } catch {}
  }, [uid]);

  useEffect(() => {
    const sentry = getSentryGlobal();
    if (!sentry) return;
    try {
      sentry.setTag?.("roomPhase", phase);
      sentry.setTag?.("roomJoin", joinStatus);
      const role = isHost ? "host" : isMember ? "player" : "guest";
      sentry.setTag?.("roomRole", role);
      if (spectatorStatus) {
        sentry.setTag?.("spectator", spectatorStatus);
      } else {
        sentry.setTag?.("spectator", "none");
      }
    } catch {}
  }, [phase, joinStatus, isHost, isMember, spectatorStatus]);

  useEffect(() => {
    const sentry = getSentryGlobal();
    if (!sentry) return;
    try {
      sentry.setContext?.("room", {
        id: roomId,
        phase,
        joinStatus,
        isHost,
        isMember,
        spectatorStatus: spectatorStatus ?? null,
        presenceReady,
        presenceDegraded,
        syncHealth: syncHealth ?? null,
      });
    } catch {}
  }, [
    roomId,
    phase,
    joinStatus,
    isHost,
    isMember,
    spectatorStatus,
    presenceReady,
    presenceDegraded,
    syncHealth,
  ]);

  return null;
}
