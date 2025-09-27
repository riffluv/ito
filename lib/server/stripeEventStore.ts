import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";

const COLLECTION_NAME = "stripe_events";

type EventRecord = {
  processedAt: FieldValue;
  type: string;
};

export async function recordStripeEvent(eventId: string, eventType: string): Promise<boolean> {
  const db = getAdminDb();
  const docRef = db.collection(COLLECTION_NAME).doc(eventId);
  const snapshot = await docRef.get();
  if (snapshot.exists) {
    return false;
  }
  await docRef.set({
    processedAt: FieldValue.serverTimestamp(),
    type: eventType,
  } satisfies EventRecord);
  return true;
}
