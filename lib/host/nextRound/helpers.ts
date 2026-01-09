export { filterPresenceUids } from "@/lib/host/hostActionsControllerHelpers";

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
