import type { Scenario } from "@/lib/showtime/types";

/**
 * SHOWTIME (Phase 0)
 *
 * `room.status` が `reveal` / `finished` に遷移したタイミングだけで呼ばれる
 * 既存のシナリオ。Phase 2 以降で intent 駆動イベントと統合する前提のため、
 * 現状問題（RESET でも回ってしまう）をコメントに残す。
 *
 * サウンド再生について:
 * - 勝利/敗北のファンファーレ・BGMは GameResultOverlay の GSAP Timeline onStart で統一
 * - ホスト/非ホストで同じタイミング（アニメーションの山場）で再生させるため
 * - showtime 経由での audio.play は削除（重複・タイミングズレの原因になるため）
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
  // audio.play は削除: サウンドは GameResultOverlay の Timeline onStart で統一
  // ホスト/非ホストのタイミング差異を解消するため
];
