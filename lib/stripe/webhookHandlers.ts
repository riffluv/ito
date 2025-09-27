import type Stripe from "stripe";
import { logInfo, logWarn, logDebug } from "@/lib/utils/log";

function getMetadataValue<T extends string>(metadata: Stripe.Metadata | null, key: string): T | undefined {
  if (!metadata) return undefined;
  const value = metadata[key];
  if (typeof value !== "string") return undefined;
  return value as T;
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const customerEmail = session.customer_details?.email || session.customer_email || undefined;
  const tierId = getMetadataValue<string>(session.metadata ?? null, "tierId");
  logInfo("stripe", "checkout.session.completed", {
    id: session.id,
    customerEmail,
    amountTotal: session.amount_total,
    currency: session.currency,
    tierId,
  });
  // Fulfillment logic will be implemented alongside the donation flow UI.
}

async function handlePaymentIntentSucceeded(intent: Stripe.PaymentIntent) {
  logInfo("stripe", "payment_intent.succeeded", {
    id: intent.id,
    amount: intent.amount_received,
    currency: intent.currency,
  });
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutSessionCompleted(session);
      break;
    }
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      await handlePaymentIntentSucceeded(intent);
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      logWarn("stripe", "payment_intent.payment_failed", {
        id: intent.id,
        lastPaymentError: intent.last_payment_error?.message,
      });
      break;
    }
    default: {
      logDebug("stripe", "Unhandled event", { type: event.type, id: event.id });
    }
  }
}
