import { auth } from "@/lib/firebase/client";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction } from "@/lib/utils/trace";

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
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
      signal: controller?.signal,
    });
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError") {
      traceAction("api.timeout", { url, timeoutMs: String(API_TIMEOUT_MS) });
      setMetric("api", "lastTimeout", `${API_TIMEOUT_MS}@${url}`);
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

  if (!res.ok) {
    const code =
      typeof (json as { error?: unknown })?.error === "string"
        ? (json as { error: string }).error
        : undefined;
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

