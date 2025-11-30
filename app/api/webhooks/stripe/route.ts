import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client";
import { handleStripeEvent } from "@/lib/stripe/webhookHandlers";
import { recordStripeEvent } from "@/lib/server/stripeEventStore";
import { logError, logWarn } from "@/lib/utils/log";
import * as Sentry from "@sentry/nextjs";

export const runtime = "nodejs";

const MAX_WEBHOOK_BODY_BYTES = 2 * 1024 * 1024; // 2MB guard

const reportStripeFailure = (message: string, extra?: Record<string, unknown>) => {
  const err = new Error(message);
  Sentry.captureException(err, {
    tags: { scope: "stripe" },
    extra,
  });
};

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
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured. Webhook skipped." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  const declaredLengthHeader = request.headers.get("content-length");
  const declaredLength = declaredLengthHeader ? Number.parseInt(declaredLengthHeader, 10) : null;

  if (declaredLength !== null && Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BODY_BYTES) {
    reportStripeFailure("Stripe webhook payload too large (declared)", {
      hasSignature: Boolean(signature),
      contentLength: declaredLength,
    });
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  if (!signature) {
    reportStripeFailure("Missing stripe-signature header", {
      hasSignature: false,
      contentLength: declaredLength,
    });
    return badRequest("Missing stripe-signature header");
  }

  let secret: string;
  try {
    secret = getWebhookSecret();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError("stripe", "webhook secret missing", err);
    Sentry.captureException(err, {
      tags: { scope: "stripe" },
      extra: { phase: "webhook:get-secret" },
    });
    return NextResponse.json({ error: "Stripe webhook secret not configured" }, { status: 500 });
  }

  const rawBody = Buffer.from(await request.arrayBuffer());

  if (rawBody.byteLength > MAX_WEBHOOK_BODY_BYTES) {
    reportStripeFailure("Stripe webhook payload too large", {
      hasSignature: Boolean(signature),
      contentLength: rawBody.byteLength,
    });
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let client: Stripe;
  try {
    client = getStripeClient();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError("stripe", "webhook client init failed", err);
    Sentry.captureException(err, {
      tags: { scope: "stripe" },
      extra: { phase: "webhook:get-client" },
    });
    return NextResponse.json(
      { error: "Stripe backend is not ready. Please configure credentials." },
      { status: 503 }
    );
  }

  let event: Stripe.Event;

  try {
    event = client.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    reportStripeFailure("Invalid stripe signature", {
      hasSignature: true,
      contentLength: rawBody.byteLength,
    });
    return badRequest("Invalid signature", error);
  }

  try {
    const isNew = await recordStripeEvent(event.id, event.type);
    if (!isNew) {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError("stripe", "failed to persist webhook event", err);
    Sentry.captureException(err, {
      tags: { scope: "stripe" },
      extra: { phase: "webhook:persist-event", eventId: event.id, eventType: event.type },
    });
  }

  try {
    await handleStripeEvent(event);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError("stripe", "handler failed", { type: event.type, error: err });
    Sentry.captureException(err, {
      tags: { scope: "stripe" },
      extra: { phase: "webhook:handler", eventType: event.type, eventId: event.id },
    });
    return NextResponse.json({ error: "Handler failure" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}


