import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { getStripeClient } from "@/lib/stripe/client";
import { logInfo, logWarn } from "@/lib/utils/log";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import Stripe from "stripe";

type EventContext = {
  id: string;
  type: string;
  created: number;
};

type Beneficiary =
  | { type: "userId"; key: string }
  | { type: "clientReferenceId"; key: string }
  | { type: "email"; key: string }
  | { type: "customerId"; key: string };

type NormalizedLineItem = {
  id: string;
  description: string | null;
  priceId: string | null;
  productId: string | null;
  quantity: number;
  amountSubtotal: number | null;
  amountTotal: number | null;
};

type SessionDocUpdate = Record<string, unknown>;

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

function timestampFromSeconds(
  seconds: number | null | undefined
): Timestamp | null {
  if (!seconds || seconds <= 0) {
    return null;
  }
  return Timestamp.fromMillis(seconds * 1000);
}

function normalizeMetadata(
  metadata: Stripe.Metadata | null | undefined
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!metadata) return result;
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "string" && value.length > 0) {
      result[key] = value;
    }
  }
  return result;
}

async function retrieveCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const client = getStripeClient();
  return client.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items", "payment_intent"],
  });
}

function mapLineItems(session: Stripe.Checkout.Session): NormalizedLineItem[] {
  if (!session.line_items || !("data" in session.line_items)) {
    return [];
  }
  return session.line_items.data.map((item) => {
    const price = typeof item.price === "string" ? null : (item.price ?? null);

    const productId =
      price && typeof price.product === "string"
        ? price.product
        : price && price.product && typeof price.product === "object"
          ? price.product.id
          : null;

    return {
      id: item.id,
      description: item.description ?? null,
      priceId:
        typeof item.price === "string" ? item.price : (price?.id ?? null),
      productId,
      quantity: item.quantity ?? 1,
      amountSubtotal: item.amount_subtotal ?? null,
      amountTotal: item.amount_total ?? null,
    };
  });
}

function resolveBeneficiary(
  session: Stripe.Checkout.Session,
  normalizedMetadata: Record<string, string>
): Beneficiary | null {
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

function omitUndefined(
  input: Record<string, unknown>
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

function buildEventInfo(context: EventContext) {
  return omitUndefined({
    id: context.id,
    type: context.type,
    createdAt: timestampFromSeconds(context.created) ?? null,
    recordedAt: FieldValue.serverTimestamp(),
  });
}

export async function applyCheckoutFulfillment(
  session: Stripe.Checkout.Session,
  context: EventContext
): Promise<void> {
  const fullSession = await retrieveCheckoutSession(session.id);
  const metadata = normalizeMetadata(fullSession.metadata);
  const lineItems = mapLineItems(fullSession);
  const beneficiary = resolveBeneficiary(fullSession, metadata);

  const paymentStatus =
    fullSession.payment_status ?? session.payment_status ?? "unpaid";
  const isPaid =
    paymentStatus === "paid" || paymentStatus === "no_payment_required";
  const db = getAdminDb();

  if (!isPaid) {
    logInfo("stripe", "checkout session not yet paid, skipping fulfillment", {
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
    const createdAt =
      timestampFromSeconds(fullSession.created) ??
      timestampFromSeconds(session.created) ??
      Timestamp.now();

    const customerId = (() => {
      if (typeof fullSession.customer === "string") return fullSession.customer;
      if (fullSession.customer && typeof fullSession.customer === "object") {
        return fullSession.customer.id;
      }
      return null;
    })();

    const baseDoc: SessionDocUpdate = omitUndefined({
      amountSubtotal: fullSession.amount_subtotal ?? null,
      amountTotal,
      currency: fullSession.currency ?? null,
      customerId,
      customerEmail:
        fullSession.customer_details?.email ??
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
      paymentIntentId:
        typeof fullSession.payment_intent === "string"
          ? fullSession.payment_intent
          : (fullSession.payment_intent?.id ?? null),
      subscriptionId:
        typeof fullSession.subscription === "string"
          ? fullSession.subscription
          : (fullSession.subscription?.id ?? null),
      updatedAt: FieldValue.serverTimestamp(),
      lastEvent: buildEventInfo(context),
    });

    if (!sessionSnap.exists) {
      baseDoc.createdAt = createdAt;
      baseDoc.firstEventId = context.id;
    }

    const existingData = sessionSnap.data() as
      | Record<string, unknown>
      | undefined;
    const existingFulfillmentRaw = existingData?.["fulfillment"];
    const existingFulfillment =
      existingFulfillmentRaw && typeof existingFulfillmentRaw === "object"
        ? (existingFulfillmentRaw as Record<string, unknown>)
        : undefined;
    const alreadyFulfilled = existingFulfillment?.["status"] === "fulfilled";

    if (isPaid && !alreadyFulfilled) {
      baseDoc.fulfillment = omitUndefined({
        status: "fulfilled",
        completedAt: FieldValue.serverTimestamp(),
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
          grantedAt: FieldValue.serverTimestamp(),
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
      } else {
        logWarn("stripe", "fulfilled checkout session without beneficiary", {
          sessionId: fullSession.id,
          eventId: context.id,
        });
      }
    } else if (!isPaid && !alreadyFulfilled) {
      baseDoc.fulfillment = omitUndefined({
        status: "pending",
        version: FULFILLMENT_VERSION,
      });
    }

    tx.set(sessionsRef, baseDoc, { merge: true });
  });

  if (isPaid) {
    logInfo("stripe", "checkout session fulfilled", {
      sessionId: session.id,
      beneficiary,
      amountTotal,
    });
  }
}

export async function markCheckoutSessionFailed(
  session: Stripe.Checkout.Session,
  context: EventContext,
  reason: string
): Promise<void> {
  const fullSession = await retrieveCheckoutSession(session.id);
  const metadata = normalizeMetadata(fullSession.metadata);
  const lineItems = mapLineItems(fullSession);
  const db = getAdminDb();

  await db.runTransaction(async (tx) => {
    const sessionsRef = db.collection(CHECKOUT_COLLECTION).doc(fullSession.id);
    const entitlementRef = db
      .collection(ENTITLEMENT_COLLECTION)
      .doc(fullSession.id);
    const baseDoc: SessionDocUpdate = omitUndefined({
      paymentStatus:
        fullSession.payment_status ?? session.payment_status ?? null,
      status: fullSession.status ?? session.status ?? null,
      updatedAt: FieldValue.serverTimestamp(),
      lastEvent: buildEventInfo(context),
      failure: omitUndefined({
        reason,
        recordedAt: FieldValue.serverTimestamp(),
      }),
      metadata,
      lineItems,
    });

    baseDoc.fulfillment = omitUndefined({
      status: "failed",
      version: FULFILLMENT_VERSION,
      failedAt: FieldValue.serverTimestamp(),
      failureReason: reason,
    });

    tx.set(sessionsRef, baseDoc, { merge: true });

    const entitlementSnap = await tx.get(entitlementRef);
    if (entitlementSnap.exists) {
      tx.set(
        entitlementRef,
        omitUndefined({
          status: "revoked",
          revokedAt: FieldValue.serverTimestamp(),
          revokeReason: reason,
          event: buildEventInfo(context),
        }),
        { merge: true }
      );
    }
  });

  logWarn("stripe", "checkout session marked as failed", {
    sessionId: session.id,
    reason,
  });
}
