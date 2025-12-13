import { useCallback, useEffect, useRef, useState } from "react";
import { APP_VERSION } from "@/lib/constants/appVersion";
import { traceError } from "@/lib/utils/trace";

async function requestHostSession(roomId: string, token: string) {
  const res = await fetch(`/api/rooms/${roomId}/host-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, clientVersion: APP_VERSION }),
  });
  if (!res.ok) throw new Error("host-session-issue-failed");
  const json = (await res.json()) as { ok: boolean; sessionId?: string };
  if (!json.ok || !json.sessionId) throw new Error("host-session-invalid");
  return json.sessionId;
}

export function useHostSession(roomId: string, getIdToken: () => Promise<string | null>) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const issuingRef = useRef(false);

  const ensureSession = useCallback(async () => {
    if (sessionId || issuingRef.current) return sessionId;
    issuingRef.current = true;
    try {
      const token = await getIdToken();
      if (!token) return null;
      const sid = await requestHostSession(roomId, token);
      setSessionId(sid);
      return sid;
    } catch (error) {
      traceError("hostSession.ensure", error, { roomId });
      return null;
    } finally {
      issuingRef.current = false;
    }
  }, [getIdToken, roomId, sessionId]);

  useEffect(() => {
    setSessionId(null);
  }, [roomId]);

  return { sessionId, ensureSession } as const;
}
