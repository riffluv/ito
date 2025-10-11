import type { Scenario } from "@/lib/showtime/types";

type RevealContext = {
  success?: boolean | null;
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
  },
  {
    action: "background.lightSweep",
  },
  {
    action: "audio.play",
    params: (ctx) => ({
      id: ctx.success ? "result_victory" : "result_failure",
    }),
    fireAndForget: true,
  },
  {
    action: "banner.show",
    params: (ctx) => ({
      text: ctx.success ? "勝利！" : "惜しい…",
      subtext: ctx.success
        ? "素晴らしいチームワークでした"
        : "次のラウンドで巻き返そう",
      variant: ctx.success ? "success" : "warning",
      durationMs: 3200,
    }),
    fireAndForget: true,
  },
];

