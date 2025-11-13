"use client";

import { auth } from "@/lib/firebase/client";
import { logWarn } from "@/lib/utils/log";
import { signInAnonymously } from "firebase/auth";

let refreshPromise: Promise<void> | null = null;

async function refreshIdToken(reason?: string) {
  const currentUser = auth?.currentUser;
  if (!currentUser) {
    return;
  }
  try {
    await currentUser.getIdToken(true);
  } catch (error) {
    logWarn("auth", "anonymous-token-refresh-failed", { reason, error });
    throw error;
  }
}

async function anonymousSignIn(reason?: string) {
  if (!auth) return;
  try {
    await signInAnonymously(auth);
  } catch (error) {
    logWarn("auth", "anonymous-signin-failed", { reason, error });
    throw error;
  }
}

/**
 * Ensure that the Firebase auth session is still valid.
 * Used when Firestore reports permission-denied so we can
 * refresh the token (or re-sign-in) without forcing a reload.
 */
export async function ensureAuthSession(reason?: string) {
  if (!auth) return;
  if (refreshPromise) {
    try {
      await refreshPromise;
    } catch {
      // 最終的な呼び出し側で再試行する
    }
    return;
  }

  refreshPromise = (async () => {
    try {
      await refreshIdToken(reason);
    } catch {
      await anonymousSignIn(reason);
    }
  })();

  try {
    await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}
