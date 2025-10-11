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
];

