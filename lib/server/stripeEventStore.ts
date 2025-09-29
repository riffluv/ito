import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

const COLLECTION_NAME = "stripe_events";

type EventRecord = {
  processedAt: FieldValue;
  createdAt: FieldValue;
  expiresAt: Timestamp;
  type: string;
};

function resolveEventExpiry(): Timestamp {
  const raw = Number(process.env.STRIPE_EVENT_TTL_DAYS ?? "30");
  const days = Number.isFinite(raw) && raw > 0 ? raw : 30;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return Timestamp.fromDate(expires);
}

export async function recordStripeEvent(
  eventId: string,
  eventType: string
): Promise<boolean> {
  const db = getAdminDb();
  const docRef = db.collection(COLLECTION_NAME).doc(eventId);
  const snapshot = await docRef.get();
  if (snapshot.exists) {
    return false;
  }
  await docRef.set({
    processedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
    type: eventType,
    expiresAt: resolveEventExpiry(),
  } satisfies EventRecord);
  return true;
}
