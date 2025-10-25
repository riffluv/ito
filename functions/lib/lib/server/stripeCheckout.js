"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCheckoutFulfillment = applyCheckoutFulfillment;
exports.markCheckoutSessionFailed = markCheckoutSessionFailed;
const firebaseAdmin_1 = require("@/lib/server/firebaseAdmin");
const client_1 = require("@/lib/stripe/client");
const log_1 = require("@/lib/utils/log");
const firestore_1 = require("firebase-admin/firestore");
const Sentry = __importStar(require("@sentry/nextjs"));
const CHECKOUT_COLLECTION = "stripe_checkout_sessions";
const ENTITLEMENT_COLLECTION = "stripe_checkout_entitlements";
const FULFILLMENT_VERSION = 1;
const BENEFICIARY_METADATA_KEYS = [
    "userId",
    "uid",
    "playerId",
    "accountId",
    "beneficiaryId",
    "beneficiary",
    "ownerId",
    "profileId",
];
function timestampFromSeconds(seconds) {
    if (!seconds || seconds <= 0) {
        return null;
    }
    return firestore_1.Timestamp.fromMillis(seconds * 1000);
}
function normalizeMetadata(metadata) {
    const result = {};
    if (!metadata)
        return result;
    for (const [key, value] of Object.entries(metadata)) {
        if (typeof value === "string" && value.length > 0) {
            result[key] = value;
        }
    }
    return result;
}
async function retrieveCheckoutSession(sessionId) {
    const client = (0, client_1.getStripeClient)();
    return client.checkout.sessions.retrieve(sessionId, {
        expand: ["line_items", "payment_intent"],
    });
}
function mapLineItems(session) {
    if (!session.line_items || !("data" in session.line_items)) {
        return [];
    }
    return session.line_items.data.map((item) => {
        const price = typeof item.price === "string" ? null : (item.price ?? null);
        const productId = price && typeof price.product === "string"
            ? price.product
            : price && price.product && typeof price.product === "object"
                ? price.product.id
                : null;
        return {
            id: item.id,
            description: item.description ?? null,
            priceId: typeof item.price === "string" ? item.price : (price?.id ?? null),
            productId,
            quantity: item.quantity ?? 1,
            amountSubtotal: item.amount_subtotal ?? null,
            amountTotal: item.amount_total ?? null,
        };
    });
}
function resolveBeneficiary(session, normalizedMetadata) {
    for (const key of BENEFICIARY_METADATA_KEYS) {
        const value = normalizedMetadata[key];
        if (value) {
            return { type: "userId", key: value };
        }
    }
    if (session.client_reference_id) {
        return { type: "clientReferenceId", key: session.client_reference_id };
    }
    const customer = session.customer;
    if (typeof customer === "string" && customer.length > 0) {
        return { type: "customerId", key: customer };
    }
    const email = session.customer_details?.email ?? session.customer_email;
    if (email) {
        return { type: "email", key: email };
    }
    return null;
}
function omitUndefined(input) {
    const output = {};
    for (const [key, value] of Object.entries(input)) {
        if (value !== undefined) {
            output[key] = value;
        }
    }
    return output;
}
function buildEventInfo(context) {
    return omitUndefined({
        id: context.id,
        type: context.type,
        createdAt: timestampFromSeconds(context.created) ?? null,
        recordedAt: firestore_1.FieldValue.serverTimestamp(),
    });
}
async function applyCheckoutFulfillment(session, context) {
    try {
        const fullSession = await retrieveCheckoutSession(session.id);
        const metadata = normalizeMetadata(fullSession.metadata);
        const lineItems = mapLineItems(fullSession);
        const beneficiary = resolveBeneficiary(fullSession, metadata);
        const paymentStatus = fullSession.payment_status ?? session.payment_status ?? "unpaid";
        const isPaid = paymentStatus === "paid" || paymentStatus === "no_payment_required";
        const db = (0, firebaseAdmin_1.getAdminDb)();
        if (!isPaid) {
            (0, log_1.logInfo)("stripe", "checkout session not yet paid, skipping fulfillment", {
                sessionId: fullSession.id,
                paymentStatus,
                eventId: context.id,
            });
        }
        const amountTotal = fullSession.amount_total ?? null;
        const totalQuantity = lineItems.reduce((sum, item) => sum + item.quantity, 0);
        await db.runTransaction(async (tx) => {
            const sessionsRef = db.collection(CHECKOUT_COLLECTION).doc(fullSession.id);
            const entitlementRef = db
                .collection(ENTITLEMENT_COLLECTION)
                .doc(fullSession.id);
            const sessionSnap = await tx.get(sessionsRef);
            const createdAt = timestampFromSeconds(fullSession.created) ??
                timestampFromSeconds(session.created) ??
                firestore_1.Timestamp.now();
            const customerId = (() => {
                if (typeof fullSession.customer === "string")
                    return fullSession.customer;
                if (fullSession.customer && typeof fullSession.customer === "object") {
                    return fullSession.customer.id;
                }
                return null;
            })();
            const baseDoc = omitUndefined({
                amountSubtotal: fullSession.amount_subtotal ?? null,
                amountTotal,
                currency: fullSession.currency ?? null,
                customerId,
                customerEmail: fullSession.customer_details?.email ??
                    fullSession.customer_email ??
                    null,
                clientReferenceId: fullSession.client_reference_id ?? null,
                paymentStatus,
                status: fullSession.status ?? session.status ?? null,
                mode: fullSession.mode,
                livemode: fullSession.livemode,
                metadata,
                lineItems,
                quantityTotal: totalQuantity,
                beneficiary: beneficiary ?? null,
                paymentIntentId: typeof fullSession.payment_intent === "string"
                    ? fullSession.payment_intent
                    : (fullSession.payment_intent?.id ?? null),
                subscriptionId: typeof fullSession.subscription === "string"
                    ? fullSession.subscription
                    : (fullSession.subscription && typeof fullSession.subscription === "object"
                        ? fullSession.subscription.id
                        : null),
                lastEvent: buildEventInfo(context),
            });
            if (!sessionSnap.exists) {
                baseDoc.createdAt = createdAt;
                baseDoc.firstEventId = context.id;
            }
            const existingData = sessionSnap.data();
            const existingFulfillmentRaw = existingData?.["fulfillment"];
            const existingFulfillment = existingFulfillmentRaw && typeof existingFulfillmentRaw === "object"
                ? existingFulfillmentRaw
                : undefined;
            const alreadyFulfilled = existingFulfillment?.["status"] === "fulfilled";
            if (isPaid && !alreadyFulfilled) {
                baseDoc.fulfillment = omitUndefined({
                    status: "fulfilled",
                    completedAt: firestore_1.FieldValue.serverTimestamp(),
                    version: FULFILLMENT_VERSION,
                    beneficiary,
                    amountTotal,
                    currency: fullSession.currency ?? null,
                });
                if (beneficiary) {
                    const entitlementDoc = omitUndefined({
                        version: FULFILLMENT_VERSION,
                        sessionId: fullSession.id,
                        status: "granted",
                        grantedAt: firestore_1.FieldValue.serverTimestamp(),
                        event: buildEventInfo(context),
                        beneficiary,
                        amountTotal,
                        currency: fullSession.currency ?? null,
                        tierId: metadata.tierId ?? null,
                        quantity: totalQuantity,
                        clientReferenceId: fullSession.client_reference_id ?? null,
                        metadata,
                        lineItems,
                    });
                    tx.set(entitlementRef, entitlementDoc, { merge: true });
                }
                else {
                    (0, log_1.logWarn)("stripe", "fulfilled checkout session without beneficiary", {
                        sessionId: fullSession.id,
                        eventId: context.id,
                    });
                }
            }
            else if (!isPaid && !alreadyFulfilled) {
                baseDoc.fulfillment = omitUndefined({
                    status: "pending",
                    version: FULFILLMENT_VERSION,
                });
            }
            tx.set(sessionsRef, baseDoc, { merge: true });
        });
        if (isPaid) {
            (0, log_1.logInfo)("stripe", "checkout session fulfilled", {
                sessionId: session.id,
                beneficiary,
                amountTotal,
            });
        }
    }
    catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        (0, log_1.logError)("stripe", "checkout-fulfillment-failed", {
            sessionId: session.id,
            eventId: context.id,
            error: err,
        });
        Sentry.captureException(err, {
            tags: { scope: "stripe" },
            extra: {
                phase: "applyCheckoutFulfillment",
                sessionId: session.id,
                eventId: context.id,
            },
        });
        throw err;
    }
}
async function markCheckoutSessionFailed(session, context, reason) {
    try {
        const fullSession = await retrieveCheckoutSession(session.id);
        const metadata = normalizeMetadata(fullSession.metadata);
        const lineItems = mapLineItems(fullSession);
        const db = (0, firebaseAdmin_1.getAdminDb)();
        await db.runTransaction(async (tx) => {
            const sessionsRef = db.collection(CHECKOUT_COLLECTION).doc(fullSession.id);
            const entitlementRef = db
                .collection(ENTITLEMENT_COLLECTION)
                .doc(fullSession.id);
            const baseDoc = omitUndefined({
                paymentStatus: fullSession.payment_status ?? session.payment_status ?? null,
                status: fullSession.status ?? session.status ?? null,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
                lastEvent: buildEventInfo(context),
                failure: omitUndefined({
                    reason,
                    recordedAt: firestore_1.FieldValue.serverTimestamp(),
                }),
                metadata,
                lineItems,
            });
            baseDoc.fulfillment = omitUndefined({
                status: "failed",
                version: FULFILLMENT_VERSION,
                failedAt: firestore_1.FieldValue.serverTimestamp(),
                failureReason: reason,
            });
            tx.set(sessionsRef, baseDoc, { merge: true });
            const entitlementSnap = await tx.get(entitlementRef);
            if (entitlementSnap.exists) {
                tx.set(entitlementRef, omitUndefined({
                    status: "revoked",
                    revokedAt: firestore_1.FieldValue.serverTimestamp(),
                    revokeReason: reason,
                    event: buildEventInfo(context),
                }), { merge: true });
            }
        });
        (0, log_1.logWarn)("stripe", "checkout session marked as failed", {
            sessionId: session.id,
            reason,
        });
    }
    catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        (0, log_1.logError)("stripe", "checkout-mark-failed", {
            sessionId: session.id,
            eventId: context.id,
            reason,
            error: err,
        });
        Sentry.captureException(err, {
            tags: { scope: "stripe" },
            extra: {
                phase: "markCheckoutSessionFailed",
                sessionId: session.id,
                eventId: context.id,
                reason,
            },
        });
        throw err;
    }
}
