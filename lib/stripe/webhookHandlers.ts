import {
  applyCheckoutFulfillment,
  markCheckoutSessionFailed,
} from "@/lib/server/stripeCheckout";
import { logDebug, logInfo, logWarn } from "@/lib/utils/log";
import type Stripe from "stripe";

function toEventContext(event: Stripe.Event) {
  return {
    id: event.id,
    type: event.type,
    created:
      typeof event.created === "number"
        ? event.created
        : Math.floor(Date.now() / 1000),
  };
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      await applyCheckoutFulfillment(session, toEventContext(event));
      break;
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      await markCheckoutSessionFailed(
        session,
        toEventContext(event),
        event.type
      );
      break;
    }
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      logInfo("stripe", "payment_intent.succeeded", {
        id: intent.id,
        amount: intent.amount_received,
        currency: intent.currency,
      });
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
