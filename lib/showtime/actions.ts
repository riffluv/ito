import { playSound } from "@/lib/audio/playSound";
import type { SoundId } from "@/lib/audio/types";
import { logDebug, logInfo, logWarn } from "@/lib/utils/log";
import type { ActionExecutor, ShowtimeContext } from "./types";

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

const audioPlay: ActionExecutor<ShowtimeContext, { id: SoundId }> = async (params) => {
  if (!params?.id) {
    logWarn(SCOPE, "audio.play missing id");
    return;
  }
  try {
    playSound(params.id);
  } catch (error) {
    logWarn(SCOPE, "audio.play failed", { error, id: params.id });
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

export const ACTION_EXECUTORS: Record<string, ActionExecutor> = {
  "background.lightSweep": backgroundLightSweep,
  "background.pointerGlow": backgroundPointerGlow,
  "audio.play": audioPlay,
  "banner.show": bannerShow,
  log: debugLog,
};

