import type { Scenario } from "@/lib/showtime/types";

/**
 * SHOWTIME (Phase 0)
 *
 * `room.status` が `reveal` / `finished` に遷移したタイミングだけで呼ばれる
 * 既存のシナリオ。Phase 2 以降で intent 駆動イベントと統合する前提のため、
 * 現状問題（RESET でも回ってしまう）をコメントに残す。
 */

type RevealContext = {
  success?: boolean | null;
  status?: string | null;
};

export const roundRevealScenario: Scenario<RevealContext> = [
  {
    action: "log",
    params: (ctx) => ({
      level: "info",
      message: "round-reveal",
      data: { success: ctx.success },
    }),
    fireAndForget: true,
    when: (ctx) => ctx.status === "reveal" || ctx.status === "finished",
  },
  {
    action: "background.lightSweep",
    when: (ctx) => ctx.status === "reveal" || ctx.status === "finished",
  },
  {
    action: "audio.play",
    when: (ctx) => ctx.status === "reveal" || ctx.status === "finished",
    params: (ctx) => ({
      id: ctx.success ? "result_victory" : "result_failure",
    }),
    fireAndForget: true,
  },
];
