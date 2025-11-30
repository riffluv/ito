import { getGlobalSoundManager } from "@/lib/audio/global";
import { playResultSound } from "@/lib/audio/resultSound";
import { playSound } from "@/lib/audio/playSound";
import type { SoundId } from "@/lib/audio/types";
import { RESULT_INTRO_DELAY } from "@/lib/ui/motion";
import { logDebug, logInfo, logWarn } from "@/lib/utils/log";
import type { ActionExecutor, ShowtimeContext } from "./types";

/**
 * SHOWTIME (Phase 0)
 *
 * ここに定義されているアクションは、RoomPage が差分監視で `showtime.play()` を呼んだ際に
 * そのままクライアント UI を操作するだけの仕組み。サーバー由来の intent や
 * Firestore publish とはまだ接続されておらず、window.bg / audio といった副作用を
 * 直接叩く現状を記録している。
 */

const SCOPE = "showtime";
export const SHOWTIME_BANNER_EVENT = "showtime:banner";

export type BannerPayload = {
  text: string;
  subtext?: string;
  variant?: "info" | "success" | "warning" | "danger";
  durationMs?: number;
};

const ensureClient = () => typeof window !== "undefined";

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    if (ms <= 0) {
      resolve();
      return;
    }
    setTimeout(resolve, ms);
  });

const backgroundLightSweep: ActionExecutor<
  ShowtimeContext,
  { delayMs?: number }
> = async (params) => {
  if (!ensureClient()) return;
  if (params?.delayMs) {
    await wait(params.delayMs);
  }
  try {
    window.bg?.lightSweep();
  } catch (error) {
    logWarn(SCOPE, "bg.lightSweep failed", error);
  }
};

const backgroundFireworks: ActionExecutor<
  ShowtimeContext,
  { delayMs?: number }
> = async (params) => {
  if (!ensureClient()) return;
  if (params?.delayMs) {
    await wait(params.delayMs);
  }
  try {
    window.bg?.launchFireworks();
  } catch (error) {
    logWarn(SCOPE, "bg.launchFireworks failed", error);
  }
};

const backgroundMeteors: ActionExecutor<
  ShowtimeContext,
  { delayMs?: number }
> = async (params) => {
  if (!ensureClient()) return;
  if (params?.delayMs) {
    await wait(params.delayMs);
  }
  try {
    window.bg?.launchMeteors();
  } catch (error) {
    logWarn(SCOPE, "bg.launchMeteors failed", error);
  }
};

const backgroundPointerGlow: ActionExecutor<
  ShowtimeContext,
  { active: boolean }
> = async (params) => {
  if (!ensureClient()) return;
  try {
    window.bg?.updatePointerGlow?.(params?.active ?? false);
  } catch (error) {
    logWarn(SCOPE, "bg.updatePointerGlow failed", error);
  }
};

const backgroundFlashWhite: ActionExecutor<
  ShowtimeContext,
  { duration?: number }
> = async (params) => {
  if (!ensureClient()) return;
  try {
    window.bg?.flashWhite?.(params?.duration);
  } catch (error) {
    logWarn(SCOPE, "bg.flashWhite failed", error);
  }
};

declare global {
  interface Window {
    __ITO_LAST_RESULT_SOUND_AT__?: number;
    __ITO_REVEAL_PLAN_LAST_END__?: number | null;
    __ITO_REVEAL_PLAN_LENGTH__?: number | null;
    __ITO_REVEAL_PLAN_BUILT_AT__?: number | null;
    __ITO_RESULT_SOUND_PENDING__?: boolean;
    __ITO_RESULT_SOUND_SCHEDULED_AT__?: number | null;
  }
}

const audioPlay: ActionExecutor<ShowtimeContext, { id: SoundId }> = async (
  params
) => {
  const requestedId = params?.id;
  if (!requestedId) {
    logWarn(SCOPE, "audio.play missing id");
    return;
  }

  let delayMs: number = 0;
  const isResult =
    requestedId === "result_victory" || requestedId === "result_failure";

  // リビール中の早すぎる再生を防ぎ、最後のカードフリップ直後を狙って鳴らす
  if (
    isResult &&
    delayMs === 0 &&
    typeof window !== "undefined"
  ) {
    const endAt = window.__ITO_REVEAL_PLAN_LAST_END__ ?? null;
    if (typeof endAt === "number") {
      const now = Date.now();
      const computed = endAt - now + RESULT_INTRO_DELAY;
      if (computed > 0) {
        delayMs = Math.min(computed, 6000); // 上限キャップ（安全）
      }
    }
    if (delayMs === 0) {
      // プランが無い場合は保守的に遅らせる
      delayMs = 1800;
    }
  }

  try {
    // 観戦など無操作でも鳴らせるよう、再生前に解錠を試みる
    const mgr = getGlobalSoundManager();
    if (mgr) {
      try {
        mgr.markUserInteraction();
        await mgr.prepareForInteraction();
      } catch {
        // 解錠失敗は握りつぶす
      }
    }

    if (isResult) {
      await playResultSound({
        outcome: requestedId === "result_victory" ? "victory" : "failure",
        delayMs,
        reason: "showtime",
      });
      return;
    }

    playSound(requestedId);
  } catch (error) {
    logWarn(SCOPE, "audio.play failed", { error, id: requestedId });
  }
};

const bannerShow: ActionExecutor<ShowtimeContext, BannerPayload> = async (
  params
) => {
  if (!ensureClient()) return;
  const detail: BannerPayload = {
    text: params?.text ?? "",
    subtext: params?.subtext,
    variant: params?.variant ?? "info",
    durationMs: params?.durationMs ?? 2600,
  };
  window.dispatchEvent(new CustomEvent(SHOWTIME_BANNER_EVENT, { detail }));
};

const debugLog: ActionExecutor<
  ShowtimeContext,
  { level?: "debug" | "info" | "warn"; message: string; data?: unknown }
> = async (params) => {
  const level = params?.level ?? "debug";
  const message = params?.message ?? "";
  const data = params?.data;
  switch (level) {
    case "info":
      logInfo(SCOPE, message, data);
      break;
    case "warn":
      logWarn(SCOPE, message, data);
      break;
    default:
      logDebug(SCOPE, message, data);
      break;
  }
};

const asGenericExecutor = <P extends Record<string, unknown> | void>(
  executor: ActionExecutor<ShowtimeContext, P>
): ActionExecutor => executor as ActionExecutor;

export const ACTION_EXECUTORS: Record<string, ActionExecutor> = {
  "background.lightSweep": asGenericExecutor(backgroundLightSweep),
  "background.fireworks": asGenericExecutor(backgroundFireworks),
  "background.meteors": asGenericExecutor(backgroundMeteors),
  "background.pointerGlow": asGenericExecutor(backgroundPointerGlow),
  "background.flashWhite": asGenericExecutor(backgroundFlashWhite),
  "audio.play": asGenericExecutor(audioPlay),
  "banner.show": asGenericExecutor(bannerShow),
  log: asGenericExecutor(debugLog),
};
