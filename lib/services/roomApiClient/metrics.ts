import { setMetric } from "@/lib/utils/metrics";

const ENABLE_INTERACTION_TAGS =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_PERF_INTERACTION_TAGS === "1";
const TRACE_BUFFER_KEY = "__ITO_TRACE_BUFFER__";
const TRACE_RECENT_THRESHOLD_MS = 2000;

type TraceBufferRecord = {
  name: string;
  detail?: Record<string, unknown>;
  timestamp: number;
};

export function normalizeApiUrlForMetrics(url: string): string {
  let normalized = url;
  const queryIndex = normalized.indexOf("?");
  if (queryIndex >= 0) {
    normalized = normalized.slice(0, queryIndex);
  }
  normalized = normalized.replace(/^https?:\/\/[^/]+/i, "");
  normalized = normalized.replace(/^\/?/, "/");

  // room-scoped routes
  normalized = normalized.replace(/^\/api\/rooms\/[^/]+\//, "/api/rooms/:roomId/");

  // spectator routes
  normalized = normalized.replace(
    /^\/api\/spectator\/invites\/[^/]+\//,
    "/api/spectator/invites/:inviteId/"
  );
  normalized = normalized.replace(
    /^\/api\/spectator\/sessions\/[^/]+\//,
    "/api/spectator/sessions/:sessionId/"
  );

  return normalized;
}

export function shouldRecordApiTiming(normalizedUrl: string): boolean {
  // High-frequency endpoints: sample or skip to avoid excessive noise.
  if (normalizedUrl.includes("/heartbeat")) return false;
  if (normalizedUrl.includes("/proposal")) return Math.random() < 0.05;
  return true;
}

export function pickRecentTraceTags(startedAt: number): Record<string, string> | undefined {
  if (!ENABLE_INTERACTION_TAGS) return undefined;
  if (typeof performance === "undefined") return undefined;
  const scope = globalThis as typeof globalThis & {
    [TRACE_BUFFER_KEY]?: TraceBufferRecord[];
  };
  const buffer = scope[TRACE_BUFFER_KEY];
  if (!buffer || buffer.length === 0) return undefined;

  let candidate: TraceBufferRecord | undefined;
  for (let index = buffer.length - 1; index >= 0; index -= 1) {
    const record = buffer[index];
    if (!record) continue;
    if (
      startedAt >= record.timestamp &&
      startedAt - record.timestamp <= TRACE_RECENT_THRESHOLD_MS
    ) {
      candidate = record;
      break;
    }
  }
  if (!candidate) return undefined;

  const tags: Record<string, string> = {
    trace: candidate.name.slice(0, 60),
  };

  if (candidate.detail && typeof candidate.detail === "object") {
    const detail = candidate.detail as Record<string, unknown>;
    const maybeString = (value: unknown) =>
      typeof value === "string" && value.length > 0 ? value.slice(0, 80) : undefined;
    const phase = maybeString(detail.phase);
    if (phase) tags.tracePhase = phase;
    const source = maybeString(detail.source);
    if (source) tags.traceSource = source;
    const scopeTag = maybeString(detail.scope);
    if (scopeTag) tags.traceScope = scopeTag;
  }

  if (tags.trace) {
    setMetric("api", "lastTrace", tags.trace);
  }
  return tags;
}
