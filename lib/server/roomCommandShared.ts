import { FieldValue } from "firebase-admin/firestore";
import { promises as fs } from "fs";
import path from "path";

import { getAdminRtdb } from "@/lib/server/firebaseAdmin";
import { releaseRoomLock } from "@/lib/server/roomQueue";
import { sanitizePlainText } from "@/lib/utils/sanitize";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  parseItoWordMarkdown,
  topicTypeLabels,
  type TopicSections,
  type TopicType,
} from "@/lib/topics";
import type { RoomDoc } from "@/lib/types";

export type CodedError = Error & { code?: string; reason?: string };

export const codedError = (
  message: string,
  code: string,
  reason?: string
): CodedError => {
  const err = new Error(message) as CodedError;
  err.code = code;
  if (reason) err.reason = reason;
  return err;
};

export const sanitizeName = (value: string) =>
  sanitizePlainText(value).slice(0, 24);

export const sanitizeClue = (value: string) =>
  sanitizePlainText(value).slice(0, 120);

export const sanitizeTopicText = (value: string) =>
  sanitizePlainText(value).slice(0, 240);

export const safeTraceAction = (name: string, detail?: Record<string, unknown>) => {
  try {
    traceAction(name, detail);
  } catch {
    // swallow tracing failures on the server to avoid impacting API responses
  }
};

export const releaseLockSafely = async (roomId: string, holder: string) => {
  try {
    await releaseRoomLock(roomId, holder);
  } catch (error) {
    traceError("room.lock.release", error, { roomId, holder });
  }
};

export const waitMs = (durationMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, durationMs));

export const clearRoundPreparingWithRetry = async (params: {
  roomRef: FirebaseFirestore.DocumentReference;
  roomId: string;
  context: string;
}): Promise<boolean> => {
  const { roomRef, roomId, context } = params;
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await roomRef.update({
        "ui.roundPreparing": false,
        lastActiveAt: FieldValue.serverTimestamp() as unknown as RoomDoc["lastActiveAt"],
      });
      return true;
    } catch (error) {
      traceError("ui.roundPreparing.clear.retry", error, { roomId, attempt, context });
      if (attempt < MAX_ATTEMPTS) {
        await waitMs(100);
      }
    }
  }
  return false;
};

export const fetchPresenceUids = async (roomId: string): Promise<string[] | null> => {
  const rtdb = getAdminRtdb();
  if (!rtdb) return null;
  try {
    const snap = await rtdb.ref(`presence/${roomId}`).get();
    const val =
      (snap.val() as Record<
        string,
        Record<string, { online?: boolean; ts?: number }>
      > | null) ?? {};
    const now = Date.now();
    const ACTIVE_WINDOW_MS = 30_000;
    const online: string[] = [];
    for (const [uid, conns] of Object.entries(val)) {
      const hasActive = Object.values(conns ?? {}).some((c) => {
        if (c?.online === false) return false;
        const ts = typeof c?.ts === "number" ? c.ts : 0;
        if (!ts) return true;
        return now - ts <= ACTIVE_WINDOW_MS;
      });
      if (hasActive) online.push(uid);
    }
    return online;
  } catch {
    return null;
  }
};

let cachedTopicSections: TopicSections | null = null;
let cachedTopicSectionsPromise: Promise<TopicSections> | null = null;

export const loadTopicSectionsFromFs = async (): Promise<TopicSections> => {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && cachedTopicSections) {
    return cachedTopicSections;
  }
  if (isProd && cachedTopicSectionsPromise) {
    return cachedTopicSectionsPromise;
  }

  const filePath = path.join(process.cwd(), "public", "itoword.md");
  const load = fs
    .readFile(filePath, "utf8")
    .then((text) => parseItoWordMarkdown(text));

  if (!isProd) {
    return load;
  }

  cachedTopicSectionsPromise = load
    .then((sections) => {
      cachedTopicSections = sections;
      return sections;
    })
    .finally(() => {
      cachedTopicSectionsPromise = null;
    });
  return cachedTopicSectionsPromise;
};

export const isTopicTypeValue = (
  value: string | null | undefined
): value is TopicType =>
  typeof value === "string" &&
  (topicTypeLabels as readonly string[]).includes(value as TopicType);

