import type { ApiError } from "@/lib/services/roomApiClient";
import { calculateEffectiveActive } from "@/lib/utils/playerCount";

export const generateRequestId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

export function isTransientNetworkError(error: unknown): boolean {
  const apiError = error as Partial<ApiError> | null;
  const status = typeof apiError?.status === "number" ? apiError.status : undefined;
  if (typeof status === "number") return false;
  const code = typeof apiError?.code === "string" ? apiError.code : undefined;
  if (code === "timeout") return true;
  const message = getErrorMessage(error);
  return Boolean(message.match(/failed to fetch|network|load failed/i));
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

const FALLBACK_TOPIC_TYPE = "通常版";

export const normalizeTopicType = (input?: string | null): string => {
  if (!input || typeof input !== "string") return FALLBACK_TOPIC_TYPE;
  const trimmed = input.trim();
  if (!trimmed) return FALLBACK_TOPIC_TYPE;
  return trimmed;
};

type PresenceInfo = {
  presenceReady?: boolean;
  onlineUids?: (string | null | undefined)[] | null;
  playerCount?: number;
};

export function filterPresenceUids(
  onlineUids: (string | null | undefined)[] | null | undefined
): string[] | undefined {
  if (!Array.isArray(onlineUids) || onlineUids.length === 0) return undefined;
  const filtered = onlineUids.filter(
    (id): id is string => typeof id === "string" && id.trim().length > 0
  );
  return filtered.length > 0 ? filtered : undefined;
}

export function safeActiveCounts(info?: PresenceInfo) {
  const basePlayers =
    typeof info?.playerCount === "number" && Number.isFinite(info.playerCount)
      ? Math.max(0, info.playerCount)
      : 0;
  const onlineCount = Array.isArray(info?.onlineUids)
    ? info.onlineUids.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0
      ).length
    : undefined;
  const activeCount = calculateEffectiveActive(onlineCount, basePlayers, {
    maxDrift: 3,
  });
  return { activeCount, onlineCount, playerCount: basePlayers };
}
