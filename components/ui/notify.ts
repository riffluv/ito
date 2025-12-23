// Notification facade wired to Dragon Quest GSAP notifications
// Centralizes notification calls so we can change rendering strategy later easily.
import {
  dragonQuestNotify,
  muteNotification as muteNotificationInternal,
  muteNotifications as muteNotificationsInternal,
} from "@/components/ui/DragonQuestNotify";

export type NotifyOptions = {
  title?: string;
  description?: string;
  type?: "info" | "warning" | "success" | "error";
  duration?: number;
  id?: string | number;
  meta?: Record<string, unknown>;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "unknown");

const normalizeTitle = (value: string) =>
  value.replace(/\s+/g, "").replace(/🏆/g, "").trim();

const SUPPRESSED_TITLES = new Set([
  "勝利！",
  "失敗！",
  "カードを場に置きました",
  "カードをその位置に置きました",
  "カードを戻しました",
]);

const TITLE_COOLDOWNS = new Map<string, number>([
  ["今はここに置けません", 1200],
  ["自分のカードをドラッグしてください", 1200],
  ["数字が割り当てられていません", 1200],
  ["その位置には置けません", 1200],
]);

const notifyCooldowns = new Map<string, number>();

const shouldSuppressNotification = (options: NotifyOptions & { title: string }) => {
  const meta = options.meta;
  const normalizedTitle = normalizeTitle(options.title || "通知");
  if (SUPPRESSED_TITLES.has(normalizedTitle)) {
    return true;
  }
  if (meta && typeof meta.suppress === "boolean" && meta.suppress) {
    return true;
  }
  const metaCooldown =
    meta && typeof meta.cooldownMs === "number" ? meta.cooldownMs : undefined;
  const cooldownMs = metaCooldown ?? TITLE_COOLDOWNS.get(normalizedTitle);
  if (typeof cooldownMs === "number" && cooldownMs > 0) {
    const key =
      meta && typeof meta.cooldownKey === "string"
        ? meta.cooldownKey
        : normalizedTitle;
    const now = Date.now();
    const last = notifyCooldowns.get(key) ?? 0;
    if (now - last < cooldownMs) {
      return true;
    }
    notifyCooldowns.set(key, now);
  }
  return false;
};

export function notify(opts: NotifyOptions | string): void {
  const o = typeof opts === "string" ? { title: opts } : opts;
  const safeTitle = o.title && o.title.trim().length > 0 ? o.title : "通知";
  if (shouldSuppressNotification({ ...o, title: safeTitle })) {
    return;
  }
  // Defer notification creation to avoid React warnings when called during render/effects
  queueMicrotask(() => {
    dragonQuestNotify({
      id: o.id !== undefined && o.id !== null ? String(o.id) : undefined,
      title: safeTitle,
      description: o.description,
      type: o.type || "info",
      duration: o.duration,
    });
  });
}

export function muteNotification(id: string, duration = 2000) {
  queueMicrotask(() => muteNotificationInternal(id, duration));
}

export function muteNotifications(ids: string[], duration = 2000) {
  queueMicrotask(() => muteNotificationsInternal(ids, duration));
}

export type NotifyAsyncState = "pending" | "success" | "error";

type NotifyAsyncEventMap = Partial<Record<NotifyAsyncState, NotifyOptions | string>>;

export async function notifyAsync<T>(
  task: () => Promise<T>,
  events: NotifyAsyncEventMap,
  options?: { id?: string | number }
): Promise<T | null> {
  const { pending, success, error } = events;
  const finalId = options?.id !== undefined && options?.id !== null ? String(options.id) : undefined;

  if (pending) {
    notify({ ...(typeof pending === "string" ? { title: pending } : pending), id: finalId });
  }

  try {
    const result = await task();
    if (success) {
      notify({
        ...(typeof success === "string" ? { title: success } : success),
        id: finalId,
      });
    }
    return result;
  } catch (err: unknown) {
    if (error) {
      const base = typeof error === "string" ? { title: error } : error;
      notify({
        ...base,
        id: finalId,
        description: base.description ?? getErrorMessage(err),
      });
    }
    return null;
  }
}

export async function notifyPromise<T>(
  p: Promise<T>,
  opts?: {
    pending?: NotifyOptions | string;
    success?: NotifyOptions | string;
    error?: NotifyOptions | string;
  }
): Promise<T | undefined> {
  try {
    if (opts?.pending) notify(opts.pending);
    const r = await p;
    if (opts?.success) notify(opts.success);
    return r;
  } catch (err: unknown) {
    if (opts?.error) {
      const eo =
        typeof opts.error === "string" ? { title: opts.error } : opts.error;
      notify({ ...eo, description: eo.description ?? getErrorMessage(err) });
    }
    return undefined;
  }
}

