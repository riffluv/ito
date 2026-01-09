import { sendNotifyEvent } from "@/lib/firebase/events";

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error ?? "");

export async function broadcastNotify(
  roomId: string,
  type: "info" | "warning" | "success" | "error",
  title: string,
  description?: string,
  contextKey?: string
) {
  try {
    await sendNotifyEvent(roomId, { type, title, description, dedupeKey: contextKey });
  } catch {
    // ignore broadcast failure
  }
}

