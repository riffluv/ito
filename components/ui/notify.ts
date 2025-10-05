// Notification facade wired to Dragon Quest GSAP notifications
// Centralizes notification calls so we can change rendering strategy later easily.
import { dragonQuestNotify } from "@/components/ui/DragonQuestNotify";

export type NotifyOptions = {
  title?: string;
  description?: string;
  type?: "info" | "warning" | "success" | "error";
  duration?: number;
  id?: string | number;
  [key: string]: any;
};

export function notify(opts: NotifyOptions | string): void {
  const o = typeof opts === "string" ? { title: opts } : opts;
  // Defer notification creation to avoid React warnings when called during render/effects
  queueMicrotask(() => {
    dragonQuestNotify({
      id: o.id != null ? String(o.id) : undefined,
      title: o.title || "通知",
      description: o.description,
      type: o.type || "info",
      duration: o.duration,
    });
  });
}

export type NotifyAsyncState = "pending" | "success" | "error";

type NotifyAsyncEventMap = Partial<Record<NotifyAsyncState, NotifyOptions | string>>;

export async function notifyAsync<T>(
  task: () => Promise<T>,
  events: NotifyAsyncEventMap,
  options?: { id?: string | number }
): Promise<T | null> {
  const { pending, success, error } = events;
  const finalId = options?.id != null ? String(options.id) : undefined;

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
  } catch (err: any) {
    if (error) {
      const base = typeof error === "string" ? { title: error } : error;
      notify({ ...base, id: finalId, description: base.description ?? err?.message });
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
  } catch (err: any) {
    if (opts?.error) {
      const eo =
        typeof opts.error === "string" ? { title: opts.error } : opts.error;
      notify({ ...eo, description: eo.description ?? err?.message });
    }
    return undefined;
  }
}

