import { getGlobalSoundManager, waitForSoundReady } from "./global";
import type { SoundId } from "./types";
import { logWarn } from "@/lib/utils/log";
import { traceAction, traceError } from "@/lib/utils/trace";

type ResultOutcome = "victory" | "failure";

type PendingPlayback = {
  outcome: ResultOutcome;
  timer: ReturnType<typeof setTimeout>;
  scheduledAt: number;
  delayMs: number;
};

type LastPlayback = {
  outcome: ResultOutcome;
  at: number;
  soundId: SoundId;
};

type ResultSoundState = {
  pendingOutcome: ResultOutcome | null;
  pendingScheduledAt: number | null;
  lastOutcome: ResultOutcome | null;
  lastPlayedAt: number | null;
  inFlightOutcome: ResultOutcome | null;
  inFlightStartedAt: number | null;
};

type PlayResultSoundOptions = {
  outcome: ResultOutcome;
  delayMs?: number;
  readyTimeoutMs?: number;
  dedupeWindowMs?: number;
  skipIfPending?: boolean;
  reason?: string;
};

const DEFAULT_READY_TIMEOUT_MS = 2600;
const DEFAULT_DEDUPE_MS = 2600;

let pendingPlayback: PendingPlayback | null = null;
let lastPlayback: LastPlayback | null = null;
let inFlight: { outcome: ResultOutcome; startedAt: number } | null = null;

const mapOutcomeToSoundId = (
  outcome: ResultOutcome,
  successMode: "epic" | "normal" = "normal"
): SoundId => {
  if (outcome === "failure") {
    return "clear_failure";
  }
  return successMode === "epic" ? "clear_success2" : "clear_success1";
};

const setPendingDebugFlags = (pending: boolean, scheduledAt: number | null) => {
  if (typeof window === "undefined") return;
  const w = window as typeof window & {
    __ITO_RESULT_SOUND_PENDING__?: boolean;
    __ITO_RESULT_SOUND_SCHEDULED_AT__?: number | null;
  };
  w.__ITO_RESULT_SOUND_PENDING__ = pending;
  w.__ITO_RESULT_SOUND_SCHEDULED_AT__ = pending ? scheduledAt : null;
};

const setLastPlayedDebugFlag = (playedAt: number) => {
  if (typeof window === "undefined") return;
  (window as typeof window & { __ITO_LAST_RESULT_SOUND_AT__?: number }).__ITO_LAST_RESULT_SOUND_AT__ =
    playedAt;
};

const clearPendingTimer = () => {
  if (pendingPlayback?.timer) {
    clearTimeout(pendingPlayback.timer);
  }
  pendingPlayback = null;
  setPendingDebugFlags(false, null);
};

const shouldDedupe = (outcome: ResultOutcome, dedupeWindowMs: number) => {
  if (!lastPlayback) return false;
  if (lastPlayback.outcome !== outcome) return false;
  const now = Date.now();
  return now - lastPlayback.at < dedupeWindowMs;
};

export const getResultSoundState = (): ResultSoundState => ({
  pendingOutcome: pendingPlayback?.outcome ?? null,
  pendingScheduledAt: pendingPlayback?.scheduledAt ?? null,
  lastOutcome: lastPlayback?.outcome ?? null,
  lastPlayedAt: lastPlayback?.at ?? null,
  inFlightOutcome: inFlight?.outcome ?? null,
  inFlightStartedAt: inFlight?.startedAt ?? null,
});

export const resetResultSoundState = () => {
  clearPendingTimer();
  lastPlayback = null;
  inFlight = null;
  if (typeof window !== "undefined") {
    const w = window as typeof window & {
      __ITO_LAST_RESULT_SOUND_AT__?: number;
      __ITO_RESULT_SOUND_PENDING__?: boolean;
      __ITO_RESULT_SOUND_SCHEDULED_AT__?: number | null;
    };
    delete w.__ITO_LAST_RESULT_SOUND_AT__;
    delete w.__ITO_RESULT_SOUND_PENDING__;
    delete w.__ITO_RESULT_SOUND_SCHEDULED_AT__;
  }
};

export const playResultSound = async (options: PlayResultSoundOptions): Promise<void> => {
  const {
    outcome,
    delayMs = 0,
    readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS,
    dedupeWindowMs = DEFAULT_DEDUPE_MS,
    skipIfPending = true,
    reason,
  } = options;
  const now = Date.now();

  if (inFlight && inFlight.outcome === outcome && now - inFlight.startedAt < dedupeWindowMs) {
    traceAction("audio.result.skip", {
      outcome,
      reason,
      mode: "inflight",
      startedAt: inFlight.startedAt,
    });
    return;
  }

  if (pendingPlayback && skipIfPending) {
    if (pendingPlayback.outcome === outcome) {
      traceAction("audio.result.skip", {
        outcome,
        reason,
        mode: "pending-existing",
        scheduledAt: pendingPlayback.scheduledAt,
      });
      return;
    }
    traceAction("audio.result.skip", {
      outcome,
      reason,
      mode: "pending-other",
      scheduledAt: pendingPlayback.scheduledAt,
    });
    return;
  }

  if (pendingPlayback && !skipIfPending) {
    clearPendingTimer();
  }

  const execute = async () => {
    if (inFlight && inFlight.outcome === outcome && Date.now() - inFlight.startedAt < dedupeWindowMs) {
      traceAction("audio.result.skip", { outcome, reason, mode: "inflight-late" });
      return;
    }
    inFlight = { outcome, startedAt: Date.now() };

    clearPendingTimer();

    if (shouldDedupe(outcome, dedupeWindowMs)) {
      traceAction("audio.result.skip", { outcome, reason, mode: "dedupe" });
      return;
    }

    try {
      const ready = await waitForSoundReady({ timeoutMs: readyTimeoutMs });
      const manager = ready.manager ?? getGlobalSoundManager();
      if (!manager) {
        logWarn("audio.result", "SoundManager unavailable", { outcome, reason });
        return;
      }

      const successMode = manager.getSettings().successMode ?? "normal";
      const targetId = mapOutcomeToSoundId(outcome, successMode);

      try {
        manager.markUserInteraction();
      } catch {
        // noop
      }
      try {
        await manager.prepareForInteraction();
      } catch {
        // 解錠失敗は握りつぶす
      }

      try {
        await manager.play(targetId);
        const playedAt = Date.now();
        lastPlayback = { outcome, at: playedAt, soundId: targetId };
        setLastPlayedDebugFlag(playedAt);
        traceAction("audio.result.play", {
          outcome,
          targetId,
          delayMs,
          ready: ready.ready,
          timedOut: ready.timedOut,
          reason,
        });
      } catch (error) {
        traceError("audio.result.play", error, { outcome, targetId });
      }
    } finally {
      inFlight = null;
    }
  };

  if (delayMs > 0) {
    const timer = setTimeout(() => {
      void execute();
    }, delayMs);
    pendingPlayback = { outcome, timer, scheduledAt: now, delayMs };
    setPendingDebugFlags(true, now);
    traceAction("audio.result.schedule", { outcome, delayMs, reason });
    return;
  }

  await execute();
};
