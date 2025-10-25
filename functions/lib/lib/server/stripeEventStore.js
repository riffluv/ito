"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordStripeEvent = recordStripeEvent;
const firebaseAdmin_1 = require("@/lib/server/firebaseAdmin");
const firestore_1 = require("firebase-admin/firestore");
const COLLECTION_NAME = "stripe_events";
function resolveEventExpiry() {
    const raw = Number(process.env.STRIPE_EVENT_TTL_DAYS ?? "30");
    const days = Number.isFinite(raw) && raw > 0 ? raw : 30;
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return firestore_1.Timestamp.fromDate(expires);
}
async function recordStripeEvent(eventId, eventType) {
    const db = (0, firebaseAdmin_1.getAdminDb)();
    const docRef = db.collection(COLLECTION_NAME).doc(eventId);
    const snapshot = await docRef.get();
    if (snapshot.exists) {
        return false;
    }
    await docRef.set({
        processedAt: firestore_1.FieldValue.serverTimestamp(),
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        type: eventType,
        expiresAt: resolveEventExpiry(),
    });
    return true;
}
