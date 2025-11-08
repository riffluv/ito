"use client";

import { traceAction } from "@/lib/utils/trace";

type ClearFlagsInput = {
  roomId: string;
  uid: string;
  rejoinSessionKey: string | null;
  autoJoinSuppressKey?: string | null;
};

export function clearSpectatorFlags({
  roomId,
  uid,
  rejoinSessionKey,
  autoJoinSuppressKey,
}: ClearFlagsInput): { pendingCleared: boolean; autoJoinCleared: boolean } {
  if (!rejoinSessionKey || typeof window === "undefined") {
    return { pendingCleared: false, autoJoinCleared: false };
  }

  let pendingCleared = false;
  let autoJoinCleared = false;
  try {
    if (window.sessionStorage.getItem(rejoinSessionKey) !== null) {
      window.sessionStorage.removeItem(rejoinSessionKey);
      pendingCleared = true;
    }
  } catch {
    // ignore storage failures
  }

  if (autoJoinSuppressKey) {
    try {
      if (window.sessionStorage.getItem(autoJoinSuppressKey) !== null) {
        window.sessionStorage.removeItem(autoJoinSuppressKey);
        autoJoinCleared = true;
      }
    } catch {
      // ignore storage failures
    }
  }

  if (pendingCleared) {
    traceAction("spectator.pending.clear", {
      roomId,
      uid,
      autoJoinSuppressCleared: autoJoinCleared,
    });
  }

  return { pendingCleared, autoJoinCleared };
}

export function readPendingRejoinFlag({
  rejoinSessionKey,
  uid,
}: {
  rejoinSessionKey: string | null;
  uid: string | null;
}): boolean {
  if (!rejoinSessionKey || typeof window === "undefined" || !uid) {
    return false;
  }
  try {
    const stored = window.sessionStorage.getItem(rejoinSessionKey);
    return stored !== null && stored === uid;
  } catch {
    return false;
  }
}

export function readAutoJoinSuppressFlag(
  autoJoinSuppressKey: string | null
): boolean {
  if (!autoJoinSuppressKey || typeof window === "undefined") {
    return false;
  }
  try {
    return window.sessionStorage.getItem(autoJoinSuppressKey) === "1";
  } catch {
    return false;
  }
}

export function clearAutoJoinSuppressFlag({
  roomId,
  uid,
  autoJoinSuppressKey,
  context,
}: {
  roomId: string;
  uid: string | null;
  autoJoinSuppressKey: string;
  context: string;
}): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  let removed = false;
  try {
    if (window.sessionStorage.getItem(autoJoinSuppressKey) !== null) {
      window.sessionStorage.removeItem(autoJoinSuppressKey);
      removed = true;
    }
  } catch {
    // ignore storage failures
  }
  if (removed) {
    traceAction("spectator.autoJoinSuppress.clear", {
      roomId,
      uid,
      context,
    });
  }
  return removed;
}
