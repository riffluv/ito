import { getGlobalSoundManager } from "@/lib/audio/global";
import { playSound } from "@/lib/audio/playSound";
import type { SoundId } from "@/lib/audio/types";
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

const backgroundLightSweep: ActionExecutor<ShowtimeContext, { delayMs?: number }> = async (
  params
) => {
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

const backgroundFireworks: ActionExecutor<ShowtimeContext, { delayMs?: number }> = async (
  params
) => {
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

const backgroundMeteors: ActionExecutor<ShowtimeContext, { delayMs?: number }> = async (
  params
) => {
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

const backgroundPointerGlow: ActionExecutor<ShowtimeContext, { active: boolean }> = async (
  params
) => {
  if (!ensureClient()) return;
  try {
    window.bg?.updatePointerGlow?.(params?.active ?? false);
  } catch (error) {
    logWarn(SCOPE, "bg.updatePointerGlow failed", error);
  }
};

declare global {
  interface Window {
    __ITO_LAST_RESULT_SOUND_AT__?: number;
  }
}

const audioPlay: ActionExecutor<ShowtimeContext, { id: SoundId }> = async (params) => {
  const requestedId = params?.id;
  if (!requestedId) {
    logWarn(SCOPE, "audio.play missing id");
    return;
  }

  // 結果系だけはユーザー設定（ノーマル/エピック）に従って実音源へマッピングする。
  let targetId: SoundId = requestedId;
  if (requestedId === "result_victory") {
    const mgr = getGlobalSoundManager();
    const successMode = mgr?.getSettings().successMode ?? "normal";
    targetId = successMode === "epic" ? "clear_success2" : "clear_success1";
  } else if (requestedId === "result_failure") {
    targetId = "clear_failure";
  }

  try {
    playSound(targetId);
    if (
      (requestedId === "result_victory" || requestedId === "result_failure") &&
      typeof window !== "undefined"
    ) {
      window.__ITO_LAST_RESULT_SOUND_AT__ = Date.now();
    }
  } catch (error) {
    logWarn(SCOPE, "audio.play failed", { error, id: requestedId, targetId });
  }
};

const bannerShow: ActionExecutor<ShowtimeContext, BannerPayload> = async (params) => {
  if (!ensureClient()) return;
  const detail: BannerPayload = {
    text: params?.text ?? "",
    subtext: params?.subtext,
    variant: params?.variant ?? "info",
    durationMs: params?.durationMs ?? 2600,
  };
  window.dispatchEvent(new CustomEvent(SHOWTIME_BANNER_EVENT, { detail }));
};

const debugLog: ActionExecutor<ShowtimeContext, { level?: "debug" | "info" | "warn"; message: string; data?: unknown }> =
  async (params) => {
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
  "audio.play": asGenericExecutor(audioPlay),
  "banner.show": asGenericExecutor(bannerShow),
  log: asGenericExecutor(debugLog),
};

