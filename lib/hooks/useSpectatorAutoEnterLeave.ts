import type { RoomMachineClientEvent, SpectatorReason } from "@/lib/state/roomMachine";
import { useEffect, useRef } from "react";

type ForcedExitReason = "game-in-progress" | "version-mismatch" | null;
type SpectatorEnterReason = Exclude<SpectatorReason, null>;

type UseSpectatorAutoEnterLeaveParams = {
  uid: string | null;
  isSpectatorMode: boolean;
  isMember: boolean;
  isHost: boolean;
  hasOptimisticSeat: boolean;
  seatRequestPending: boolean;
  seatAcceptanceActive: boolean;
  forcedExitReason: ForcedExitReason;
  spectatorCandidate: boolean;
  spectatorEnterReason: SpectatorEnterReason | string;
  mustSpectateMidGame: boolean;
  fsmSpectatorNode: string;
  emitSpectatorEvent: (event: RoomMachineClientEvent) => void;
};

export function useSpectatorAutoEnterLeave(params: UseSpectatorAutoEnterLeaveParams) {
  const {
    uid,
    isSpectatorMode,
    isMember,
    isHost,
    hasOptimisticSeat,
    seatRequestPending,
    seatAcceptanceActive,
    forcedExitReason,
    spectatorCandidate,
    spectatorEnterReason,
    mustSpectateMidGame,
    fsmSpectatorNode,
    emitSpectatorEvent,
  } = params;

  const spectatorLeaveTimerRef = useRef<number | null>(null);
  const spectatorEnterTimerRef = useRef<number | null>(null);
  const spectatorCandidateRef = useRef<boolean>(false);

  useEffect(() => {
    spectatorCandidateRef.current = spectatorCandidate;
  }, [spectatorCandidate]);

  useEffect(() => {
    // クリーンアップ: タイマーが残らないようにする
    return () => {
      if (spectatorLeaveTimerRef.current !== null) {
        window.clearTimeout(spectatorLeaveTimerRef.current);
        spectatorLeaveTimerRef.current = null;
      }
      if (spectatorEnterTimerRef.current !== null) {
        window.clearTimeout(spectatorEnterTimerRef.current);
        spectatorEnterTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // 既に観戦中 → candidate が false に一瞬揺らいでも即 leave/reset しない（デバウンス）
    if (!spectatorCandidate) {
      if (spectatorEnterTimerRef.current !== null) {
        window.clearTimeout(spectatorEnterTimerRef.current);
        spectatorEnterTimerRef.current = null;
      }
      if (fsmSpectatorNode === "idle") {
        return;
      }
      // 観戦申請中 / 受理待ち中は触らない
      if (seatRequestPending || seatAcceptanceActive || forcedExitReason) {
        return;
      }
      if (spectatorLeaveTimerRef.current !== null) {
        window.clearTimeout(spectatorLeaveTimerRef.current);
      }
      spectatorLeaveTimerRef.current = window.setTimeout(() => {
        if (!spectatorCandidateRef.current) {
          emitSpectatorEvent({ type: "SPECTATOR_LEAVE" });
          emitSpectatorEvent({ type: "SPECTATOR_RESET" });
        }
      }, 700); // 揺らぎ吸収のため 700ms デバウンス
      return;
    }

    // candidate が true に戻ったら leave デバウンスを解除
    if (spectatorLeaveTimerRef.current !== null) {
      window.clearTimeout(spectatorLeaveTimerRef.current);
      spectatorLeaveTimerRef.current = null;
    }

    // 既に観戦状態なら何もしない
    if (fsmSpectatorNode !== "idle") {
      return;
    }
    if (mustSpectateMidGame) {
      return;
    }
    if (spectatorEnterTimerRef.current !== null) {
      window.clearTimeout(spectatorEnterTimerRef.current);
    }
    spectatorEnterTimerRef.current = window.setTimeout(() => {
      emitSpectatorEvent({
        type: "SPECTATOR_ENTER",
        reason: spectatorEnterReason as SpectatorEnterReason,
      });
    }, 220);
  }, [
    emitSpectatorEvent,
    fsmSpectatorNode,
    spectatorCandidate,
    spectatorEnterReason,
    seatRequestPending,
    seatAcceptanceActive,
    forcedExitReason,
    mustSpectateMidGame,
  ]);

  useEffect(() => {
    if (!uid) return;
    if (!isSpectatorMode) return;
    if (!isMember && !isHost && !hasOptimisticSeat) return;
    if (seatRequestPending || seatAcceptanceActive) return;
    emitSpectatorEvent({ type: "SPECTATOR_LEAVE" });
    emitSpectatorEvent({ type: "SPECTATOR_RESET" });
  }, [
    uid,
    isSpectatorMode,
    isMember,
    isHost,
    hasOptimisticSeat,
    seatRequestPending,
    seatAcceptanceActive,
    emitSpectatorEvent,
  ]);
}
