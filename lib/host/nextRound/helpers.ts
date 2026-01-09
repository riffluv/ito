type OnlineUids = (string | null | undefined)[] | null | undefined;

export function filterPresenceUids(onlineUids: OnlineUids): string[] | undefined {
  if (!Array.isArray(onlineUids) || onlineUids.length === 0) return undefined;
  const filtered = onlineUids.filter(
    (id): id is string => typeof id === "string" && id.trim().length > 0
  );
  return filtered.length > 0 ? filtered : undefined;
}

export type NextRoundFailureReason =
  | "forbidden"
  | "invalid_status"
  | "no_players"
  | "rate-limited"
  | "api-error";

export function mapNextRoundFailureReason(code: string | null | undefined): NextRoundFailureReason {
  if (code === "forbidden") return "forbidden";
  if (code === "rate_limited") return "rate-limited";
  if (code === "invalid_status") return "invalid_status";
  if (code === "no_players") return "no_players";
  return "api-error";
}

