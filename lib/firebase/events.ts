import { db } from "@/lib/firebase/client";
import { bumpMetric } from "@/lib/utils/metrics";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export type NotifyEvent = {
  kind: "notify";
  type: "info" | "warning" | "success" | "error";
  title: string;
  description?: string;
  createdAt?: Date | { toDate?: () => Date } | null;
};

const NOTIFY_DEDUP_MS = 1500;
const NOTIFY_CLEANUP_THRESHOLD = 200;
const notifyDedupCache = new Map<string, number>();

function shouldSkipNotify(key: string, now: number): boolean {
  const last = notifyDedupCache.get(key);
  if (typeof last === "number" && now - last < NOTIFY_DEDUP_MS) {
    return true;
  }
  notifyDedupCache.set(key, now);
  if (notifyDedupCache.size > NOTIFY_CLEANUP_THRESHOLD) {
    const expiry = now - NOTIFY_DEDUP_MS * 2;
    for (const [cacheKey, ts] of notifyDedupCache) {
      if (ts < expiry) {
        notifyDedupCache.delete(cacheKey);
      }
    }
  }
  return false;
}

export async function sendNotifyEvent(
  roomId: string,
  opts: {
    type: NotifyEvent["type"];
    title: string;
    description?: string;
    dedupeKey?: string;
  }
) {
  const key = `${roomId}:${opts.type}:${opts.title}:${opts.description ?? ""}:${
    opts.dedupeKey ?? ""
  }`;
  const now = Date.now();
  if (shouldSkipNotify(key, now)) {
    bumpMetric("notify", "dedupeSkipped");
    return;
  }
  bumpMetric("notify", "published");
  await addDoc(collection(db!, "rooms", roomId, "events"), {
    kind: "notify",
    type: opts.type,
    title: opts.title,
    description: opts.description ?? undefined,
    createdAt: serverTimestamp(),
  } as NotifyEvent);
}
