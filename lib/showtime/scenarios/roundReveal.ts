import type { Scenario } from "@/lib/showtime/types";

type RevealContext = {
  success?: boolean | null;
};

export const roundRevealScenario: Scenario<RevealContext> = [
  {
    action: "log",
    params: (ctx) => {
      console.log('🎆 [roundReveal] Context:', ctx);
      console.log('🎆 [roundReveal] success value:', ctx.success, 'type:', typeof ctx.success, 'is true?', ctx.success === true);
      return {
        level: "info",
        message: "round-reveal",
        data: { success: ctx.success },
      };
    },
    fireAndForget: true,
  },
  {
    action: "background.lightSweep",
  },
  {
    action: "background.fireworks",
    when: (ctx) => ctx.success === true,
    delayMs: 100,
    fireAndForget: true,
  },
  {
    action: "background.meteors",
    when: (ctx) => ctx.success === false,
    delayMs: 100,
    fireAndForget: true,
  },
  {
    action: "audio.play",
    params: (ctx) => ({
      id: ctx.success ? "result_victory" : "result_failure",
    }),
    fireAndForget: true,
  },
];

