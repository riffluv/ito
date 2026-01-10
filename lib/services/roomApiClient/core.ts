import { auth } from "@/lib/firebase/client";
import { bumpMetric, setMetric } from "@/lib/utils/metrics";
import { traceAction } from "@/lib/utils/trace";
import { recordMetricDistribution } from "@/lib/perf/metricsClient";

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

export type ApiError = Error & {
  code?: string;
  status?: number;
  details?: unknown;
  url?: string;
  method?: string;
};

const DEFAULT_API_TIMEOUT_MS = 12_000;
const parsedApiTimeout = Number(
  process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? DEFAULT_API_TIMEOUT_MS
);
const API_TIMEOUT_MS =
  Number.isFinite(parsedApiTimeout) && parsedApiTimeout > 0
    ? parsedApiTimeout
    : DEFAULT_API_TIMEOUT_MS;

function normalizeApiUrlForMetrics(url: string): string {
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

function shouldRecordApiTiming(normalizedUrl: string): boolean {
  // High-frequency endpoints: sample or skip to avoid excessive noise.
  if (normalizedUrl.includes("/heartbeat")) return false;
  if (normalizedUrl.includes("/proposal")) return Math.random() < 0.05;
  return true;
}

function pickRecentTraceTags(startedAt: number): Record<string, string> | undefined {
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
    if (startedAt >= record.timestamp && startedAt - record.timestamp <= TRACE_RECENT_THRESHOLD_MS) {
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

  return tags;
}

export const toApiError = (
  code: string | undefined,
  status: number,
  details: unknown,
  meta?: { url?: string; method?: string }
): ApiError => {
  const err = new Error(code ?? "api_error") as ApiError;
  err.code = code;
  err.status = status;
  err.details = details;
  err.url = meta?.url;
  err.method = meta?.method;
  return err;
};

function classifyConflict(
  code: string | undefined
):
  | "room/join/version-mismatch"
  | "room/create/update-required"
  | "invalid_status"
  | "other" {
  if (code === "room/join/version-mismatch") return "room/join/version-mismatch";
  if (
    code === "room/create/update-required" ||
    code === "room/create/version-mismatch"
  ) {
    return "room/create/update-required";
  }
  if (code === "invalid_status" || code === "not_waiting") return "invalid_status";
  return "other";
}

function tryKickRoomSyncOnConflict(
  url: string,
  category: ReturnType<typeof classifyConflict>,
  code: string | undefined
) {
  if (category !== "invalid_status") return;
  if (typeof window === "undefined") return;
  const match = url.match(/^\/api\/rooms\/([^/]+)\//);
  const roomId = match?.[1] ?? null;
  if (!roomId) return;
  const reason = `api409:${code ?? "unknown"}`;
  try {
    window.dispatchEvent(
      new CustomEvent("ito:room-force-refresh", {
        detail: { roomId, reason },
      })
    );
  } catch {}
  try {
    window.dispatchEvent(
      new CustomEvent("ito:room-restart-listener", {
        detail: { roomId, reason },
      })
    );
  } catch {}
  try {
    traceAction("api.conflict.409.kickRoomSync", {
      roomId,
      url,
      code: code ?? "unknown",
    });
  } catch {}
}

export async function getIdTokenOrThrow(reason?: string): Promise<string> {
  const user = auth?.currentUser;
  if (!user) {
    throw toApiError("unauthorized", 401, { reason });
  }
  try {
    return await user.getIdToken();
  } catch (error) {
    throw toApiError("unauthorized", 401, { reason, error });
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const isRetriableNetworkError = (error: unknown): boolean => {
  const code = (error as ApiError | undefined)?.code;
  if (code === "timeout") return true;
  return error instanceof TypeError;
};

export async function postJson<T>(
  url: string,
  body: Record<string, unknown>
): Promise<T> {
  const normalizedUrl = normalizeApiUrlForMetrics(url);
  const startedAt = typeof performance !== "undefined" ? performance.now() : null;
  const traceTags = startedAt !== null ? pickRecentTraceTags(startedAt) : undefined;
  if (traceTags?.trace) {
    setMetric("api", "lastTrace", traceTags.trace);
  }
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  if (controller && API_TIMEOUT_MS > 0) {
    timeoutHandle = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // noop
      }
    }, API_TIMEOUT_MS);
  }

  let res: Response;
  try {
    bumpMetric("api", "post.calls", 1);
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
      signal: controller?.signal,
    });
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError") {
      bumpMetric("api", "post.timeouts", 1);
      traceAction("api.timeout", { url, timeoutMs: String(API_TIMEOUT_MS) });
      setMetric("api", "lastTimeout", `${API_TIMEOUT_MS}@${url}`);
      setMetric("api", "lastTimeoutRoute", normalizedUrl);
      if (startedAt !== null && typeof performance !== "undefined" && shouldRecordApiTiming(normalizedUrl)) {
        const elapsedMs = Math.max(0, performance.now() - startedAt);
        recordMetricDistribution("client.api.latencyMs", elapsedMs, {
          method: "POST",
          route: normalizedUrl,
          result: "timeout",
          ...traceTags,
        });
      }
      const err = new Error("network timeout") as ApiError;
      err.code = "timeout";
      err.details = { timeoutMs: API_TIMEOUT_MS };
      err.url = url;
      err.method = "POST";
      throw err;
    }
    throw error;
  } finally {
    if (timeoutHandle !== null) {
      try {
        clearTimeout(timeoutHandle);
      } catch {
        // noop
      }
    }
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (startedAt !== null && typeof performance !== "undefined") {
    const elapsedMs = Math.max(0, performance.now() - startedAt);
    setMetric("api", "lastPostRoute", normalizedUrl);
    setMetric("api", "lastPostMs", Math.round(elapsedMs));
    setMetric("api", "lastPostAt", Date.now());
    if (shouldRecordApiTiming(normalizedUrl)) {
      recordMetricDistribution("client.api.latencyMs", elapsedMs, {
        method: "POST",
        route: normalizedUrl,
        result: res.ok ? "ok" : "error",
        status: String(res.status),
        ...traceTags,
      });
    }
  } else {
    setMetric("api", "lastPostRoute", normalizedUrl);
    setMetric("api", "lastPostAt", Date.now());
  }

  if (!res.ok) {
    bumpMetric("api", "post.errors", 1);
    const code =
      typeof (json as { error?: unknown })?.error === "string"
        ? (json as { error: string }).error
        : undefined;
    setMetric("api", "lastErrorStatus", res.status);
    setMetric("api", "lastErrorCode", code ?? "unknown");
    setMetric("api", "lastErrorRoute", normalizedUrl);
    if (res.status === 409) {
      const category = classifyConflict(code);
      traceAction("api.conflict.409", { url, code: code ?? "unknown", category });
      setMetric("api", "last409", `${category}:${code ?? "unknown"}@${url}`);
      tryKickRoomSyncOnConflict(url, category, code);
    }
    throw toApiError(code, res.status, json, { url, method: "POST" });
  }

  return json as T;
}

export async function postJsonWithRetry<T>(
  url: string,
  body: Record<string, unknown>,
  options?: { retries?: number; baseDelayMs?: number }
): Promise<T> {
  const retries = Math.max(0, options?.retries ?? 0);
  const baseDelayMs = Math.max(0, options?.baseDelayMs ?? 120);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await postJson<T>(url, body);
    } catch (error) {
      lastError = error;
      if (attempt >= retries || !isRetriableNetworkError(error)) {
        throw error;
      }
      const delayMs = baseDelayMs * (attempt + 1);
      traceAction("api.retry", { url, attempt: attempt + 1, delayMs });
      await sleep(delayMs);
    }
  }
  throw lastError;
}
