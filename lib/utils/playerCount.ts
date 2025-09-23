import { logWarn } from "@/lib/utils/log";

export function calculateEffectiveActive(
  onlineCount: number | undefined,
  playersCount: number,
  options?: { maxDrift?: number }
): number {
  const safePlayers = Number.isFinite(playersCount) ? Math.max(0, Math.trunc(playersCount)) : 0;
  const maxDrift = options?.maxDrift ?? 2;

  if (typeof onlineCount !== "number" || !Number.isFinite(onlineCount) || onlineCount < 0) {
    return safePlayers;
  }

  const normalizedOnline = Math.trunc(onlineCount);
  const drift = Math.abs(normalizedOnline - safePlayers);
  if (drift > maxDrift) {
    logWarn("playerCount", "presence-drift-detected", {
      onlineCount: normalizedOnline,
      playersCount: safePlayers,
      drift,
      maxDrift,
    });
    return Math.max(normalizedOnline, safePlayers);
  }

  return normalizedOnline;
}
