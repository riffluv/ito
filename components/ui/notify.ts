// Notification facade wired to Chakra UI v3 toaster
// Centralizes notification calls so we can change rendering strategy later easily.
import { toaster } from "@/components/ui/toaster";

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
  // Defer toast creation to avoid React warnings when called during render/effects
  queueMicrotask(() => {
    const payload: any = {};
    if (o.id != null) payload.id = o.id as any;
    if (o.title != null) payload.title = o.title;
    if (o.description != null) payload.description = o.description;
    if (o.type != null) payload.type = o.type as any;
    if (o.duration != null) payload.duration = o.duration;
    // meta で closable 等を制御可能（必要に応じて）
    toaster.create(payload);
  });
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
