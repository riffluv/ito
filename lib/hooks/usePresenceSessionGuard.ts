"use client";

import {
  attachPresenceSession,
  isPresenceSessionActive,
  subscribePresenceSessions,
  touchPresenceSession,
  type PresenceSessionRecord,
} from "@/lib/firebase/presenceSessions";
import { presenceSupported } from "@/lib/firebase/presence";
import { useCallback, useEffect, useMemo, useState } from "react";

type PresenceSessionGuardState = {
  sessionId: string | null;
  activeSessionId: string | null;
  sessionReady: boolean;
  isActiveSession: boolean;
  hasMultipleSessions: boolean;
  requestActive: () => void;
};

const SESSION_STORAGE_KEY = "ito:tab-session-id";

const createSessionId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const resolveSessionId = () => {
  if (typeof sessionStorage === "undefined") return null;
  const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (stored) return stored;
  const created = createSessionId();
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, created);
  } catch {}
  return created;
};

const toNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function usePresenceSessionGuard(
  roomId: string,
  uid: string | null
): PresenceSessionGuardState {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Record<string, PresenceSessionRecord> | null>(
    null
  );

  const guardEnabled = presenceSupported() && !!roomId && !!uid;

  useEffect(() => {
    if (!guardEnabled) {
      setSessionId(null);
      return;
    }
    const resolved = resolveSessionId();
    setSessionId(resolved);
  }, [guardEnabled]);

  useEffect(() => {
    if (!guardEnabled || !roomId || !uid || !sessionId) {
      return undefined;
    }
    const detach = attachPresenceSession(roomId, uid, sessionId);
    return () => {
      try {
        detach?.();
      } catch {}
    };
  }, [guardEnabled, roomId, uid, sessionId]);

  useEffect(() => {
    if (!guardEnabled || !roomId || !uid) {
      setSessions(null);
      return undefined;
    }
    const off = subscribePresenceSessions(roomId, uid, (val) => setSessions(val));
    return () => off();
  }, [guardEnabled, roomId, uid]);

  const { activeSessionId, hasMultipleSessions, sessionReady } = useMemo(() => {
    if (!guardEnabled) {
      return {
        activeSessionId: null,
        hasMultipleSessions: false,
        sessionReady: false,
      };
    }
    if (!sessions) {
      return {
        activeSessionId: null,
        hasMultipleSessions: false,
        sessionReady: false,
      };
    }
    const now = Date.now();
    const entries = Object.entries(sessions).filter(([, record]) =>
      isPresenceSessionActive(record, now)
    );
    const withLastActive = entries.filter(([, record]) => toNumber(record.lastActive));
    const candidates = withLastActive.length > 0 ? withLastActive : entries;
    const sorted = candidates
      .map(([id, record]) => {
        const lastActive = toNumber(record.lastActive);
        const connectedAt = toNumber(record.connectedAt);
        return {
          id,
          ts: lastActive ?? connectedAt ?? 0,
        };
      })
      .sort((a, b) => a.ts - b.ts);
    const active = sorted.length > 0 ? sorted[sorted.length - 1].id : null;
    return {
      activeSessionId: active,
      hasMultipleSessions: entries.length > 1,
      sessionReady: true,
    };
  }, [guardEnabled, sessions]);

  const isActiveSession =
    !guardEnabled || !sessionReady || !activeSessionId || activeSessionId === sessionId;

  const requestActive = useCallback(() => {
    if (!guardEnabled || !roomId || !uid || !sessionId) return;
    void touchPresenceSession(roomId, uid, sessionId);
  }, [guardEnabled, roomId, uid, sessionId]);

  return {
    sessionId,
    activeSessionId,
    sessionReady,
    isActiveSession,
    hasMultipleSessions,
    requestActive,
  };
}
