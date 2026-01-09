import { traceAction, traceError } from "@/lib/utils/trace";

export async function runRestartGame(params: {
  roomId: string;
  playSound: boolean;
  resetGame: (options?: {
    showFeedback?: boolean;
    playSound?: boolean;
    includeOnline?: boolean;
    recallSpectators?: boolean;
  }) => Promise<unknown>;
  quickStart: (options?: {
    broadcast?: boolean;
    playSound?: boolean;
    markShowtimeStart?: boolean;
    intentMeta?: { action: string };
  }) => Promise<boolean>;
}): Promise<boolean> {
  const { roomId, playSound, resetGame, quickStart } = params;

  traceAction("ui.host.restart", {
    roomId,
    playSound: playSound ? "1" : "0",
  });

  try {
    await resetGame({
      showFeedback: false,
      playSound,
      includeOnline: false,
      recallSpectators: false,
    });
    return await quickStart({
      broadcast: false,
      playSound,
      markShowtimeStart: false,
      intentMeta: { action: "quickStart:restart" },
    });
  } catch (error) {
    traceError("ui.host.restart", error, { roomId });
    throw error;
  }
}

