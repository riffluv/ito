import type { RoomDoc } from "@/lib/types";

type RoomStatus = RoomDoc["status"];

/**
 * 表示系の共通判定: リビール中かどうか。
 * 将来的にローカル/共有ゲートを併合するための小さなセレクタ。
 */
export function isRevealing(opts: {
  status: RoomStatus | undefined;
  localHide?: boolean;
  uiRevealPending?: boolean;
}): boolean {
  return opts.status === "reveal" || !!opts.localHide || !!opts.uiRevealPending;
}
