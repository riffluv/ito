import { getRoundStartSoundId, ROUND_START_GLOBAL_SOUND_ENABLED } from "@/lib/audio/roundStart";
import type { Scenario } from "@/lib/showtime/types";

/**
 * SHOWTIME (Phase 0)
 *
 * RoomPage が Firestore の `room.round` 変化を検知したときだけ再生される
 * 既存の演出シナリオ。FSM intent や phaseEvent からはまだ呼び出されない。
 */

type RoundContext = {
  round?: number;
  status?: string;
};

export const roundStartScenario: Scenario<RoundContext> = [
  {
    action: "log",
    params: (ctx) => ({
      level: "info",
      message: "round-start",
      data: { round: ctx.round, status: ctx.status },
    }),
    fireAndForget: true,
  },
  {
    action: "background.lightSweep",
    params: { delayMs: 80 },
  },
  {
    action: "audio.play",
    when: () => ROUND_START_GLOBAL_SOUND_ENABLED,
    params: (ctx) => ({
      // Host-confirm sound is played separately (useHostActions).
      // This branch is reserved for future "everyone hears the round start" cue.
      id: getRoundStartSoundId(ctx.status),
    }),
    fireAndForget: true,
  },
  {
    action: "banner.show",
    params: (ctx) => ({
      text: `ROUND ${Number(ctx.round ?? 0)}`,
      subtext: "新しい挑戦が始まる",
      variant: "info",
      durationMs: 2600,
    }),
    fireAndForget: true,
  },
  {
    action: "background.pointerGlow",
    params: { active: true },
    fireAndForget: true,
  },
  {
    action: "background.pointerGlow",
    params: { active: false },
    delayMs: 900,
    fireAndForget: true,
  },
];
