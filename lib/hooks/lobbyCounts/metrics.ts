export function recordLobbyMetric(name: string, durationMs: number, roomId: string): void {
  if (typeof window === "undefined") return;
  const w = window as typeof window & {
    __ITO_LOBBY_METRICS__?: Array<{
      name: string;
      duration: number;
      roomId: string;
      ts: number;
    }>;
  };
  if (!Array.isArray(w.__ITO_LOBBY_METRICS__)) {
    w.__ITO_LOBBY_METRICS__ = [];
  }
  w.__ITO_LOBBY_METRICS__!.push({
    name,
    duration: durationMs,
    roomId,
    ts: Date.now(),
  });
  if (w.__ITO_LOBBY_METRICS__!.length > 200) {
    w.__ITO_LOBBY_METRICS__!.splice(0, w.__ITO_LOBBY_METRICS__!.length - 200);
  }
}
