import { NextRequest, NextResponse } from "next/server";
import { getStripeClient, type Stripe } from "@/lib/stripe/client";

export const runtime = "nodejs";

function resolveWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return secret;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return badRequest("Missing stripe-signature header");
  }

  let webhookSecret: string;
  try {
    webhookSecret = resolveWebhookSecret();
  } catch (error) {
    console.error("[stripe] Webhook secret missing", error);
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let stripe: Stripe;
  try {
    stripe = getStripeClient();
  } catch (error) {
    console.error("[stripe] Stripe client initialization failed", error);
    return NextResponse.json({ error: "Stripe client not configured" }, { status: 500 });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.warn("[stripe] Invalid webhook signature", error);
    return badRequest("Invalid signature");
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log("[stripe] checkout.session.completed", {
        id: session.id,
        customer: session.customer,
        amount_total: session.amount_total,
      });
      break;
    }
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      console.log("[stripe] payment_intent.succeeded", {
        id: intent.id,
        amount: intent.amount_received,
        currency: intent.currency,
      });
      break;
    }
    default: {
      console.log("[stripe] Unhandled event", { type: event.type });
    }
  }

  return NextResponse.json({ received: true });
}
