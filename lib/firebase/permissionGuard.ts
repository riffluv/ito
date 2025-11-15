"use client";

import { notify } from "@/components/ui/notify";
import { ensureAuthSession } from "@/lib/firebase/authSession";
import { traceError } from "@/lib/utils/trace";
import type { FirebaseError } from "firebase/app";

const RECOVERY_TOAST_ID = "firestore-session-recover";

export type PermissionGuardOptions = {
  context: string;
  toastContext?: string;
  suppressToast?: boolean;
};

type PermissionState = "start" | "success" | "error";

const DEFAULT_MESSAGES: Record<PermissionState, { title: string; description: (context?: string) => string | undefined; type: "info" | "success" | "error" | "warning"; duration: number }> = {
  start: {
    title: "接続を再確認しています…",
    description: (context) =>
      context ? `${context} をやり直しています。しばらくお待ちください。` : "Firestore セッションを再確認しています。",
    type: "warning",
    duration: 4200,
  },
  success: {
    title: "接続を再開しました",
    description: (context) => (context ? `${context} を続行できます。` : undefined),
    type: "success",
    duration: 2200,
  },
  error: {
    title: "接続を再開できませんでした",
    description: () => "ページを再読み込みしてから再実行してください。",
    type: "error",
    duration: 5200,
  },
};

export function isPermissionDeniedError(error: unknown): error is FirebaseError & { code: "permission-denied" } {
  if (!error) return false;
  const code = (error as { code?: string }).code;
  return code === "permission-denied";
}

export function notifyPermissionRecovery(state: PermissionState, context?: string) {
  const payload = DEFAULT_MESSAGES[state];
  notify({
    id: RECOVERY_TOAST_ID,
    title: payload.title,
    description: payload.description(context),
    type: payload.type,
    duration: payload.duration,
  });
}

export async function withPermissionRetry<T>(
  operation: () => Promise<T>,
  options: PermissionGuardOptions
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      throw error;
    }
    traceError("firestore.permissionDenied", error, { context: options.context });
    if (!options.suppressToast) {
      notifyPermissionRecovery("start", options.toastContext);
    }

    try {
      await ensureAuthSession(options.context);
    } catch (sessionError) {
      traceError("firestore.permissionDenied.refresh", sessionError, {
        context: options.context,
      });
      if (!options.suppressToast) {
        notifyPermissionRecovery("error", options.toastContext);
      }
      throw error;
    }

    try {
      const result = await operation();
      if (!options.suppressToast) {
        notifyPermissionRecovery("success", options.toastContext);
      }
      return result;
    } catch (retryError) {
      if (!options.suppressToast && isPermissionDeniedError(retryError)) {
        notifyPermissionRecovery("error", options.toastContext);
      }
      throw retryError;
    }
  }
}
