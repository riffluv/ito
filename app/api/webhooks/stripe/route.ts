import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { handleStripeEvent } from "@/lib/stripe/webhookHandlers";
import { recordStripeEvent } from "@/lib/server/stripeEventStore";
import { logError, logWarn } from "@/lib/utils/log";

export const runtime = "nodejs";

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return secret;
}

function badRequest(message: string, detail?: unknown) {
  if (detail) {
    logWarn("stripe", "webhook rejected", { message, detail });
  }
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return badRequest("Missing stripe-signature header");
  }

  let secret: string;
  try {
    secret = getWebhookSecret();
  } catch (error) {
    logError("stripe", "webhook secret missing", error);
    return NextResponse.json({ error: "Stripe webhook secret not configured" }, { status: 500 });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());

  let client: Stripe;
  try {
    client = getStripeClient();
  } catch (error) {
    logError("stripe", "webhook client init failed", error);
    return NextResponse.json({ error: "Stripe secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = client.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    return badRequest("Invalid signature", error);
  }

  try {
    const isNew = await recordStripeEvent(event.id, event.type);
    if (!isNew) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }
  } catch (error) {
    logError("stripe", "failed to persist webhook event", error);
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    logError("stripe", "handler failed", { type: event.type, error });
    return NextResponse.json({ error: "Handler failure" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}


