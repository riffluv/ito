import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

type AuditPayload = {
  roomId: string;
  requestId: string | null;
  uid: string | null;
  command: "start" | "reset" | "next" | "deal";
  prevStatus?: string | null;
  nextStatus?: string | null;
  note?: string;
  errorCode?: string | null;
};

/**
 * Best-effort audit logger for critical room commands.
 * Writes to collection `roomCommandAudits` (append-only).
 */
export async function logRoomCommandAudit(payload: AuditPayload): Promise<void> {
  try {
    const db = getAdminDb();
    const ref = db.collection("roomCommandAudits").doc();
    await ref.set({
      ...payload,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    // audit failure must not break the main flow
  }
}
