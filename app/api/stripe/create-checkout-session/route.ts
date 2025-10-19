import { NextRequest, NextResponse } from "next/server";
import {
  getStripeClient,
  isStripeConfigured,
  type Stripe,
} from "@/lib/stripe/client";
import {
  assertAllowedPriceId,
  assertAllowedReturnUrl,
  parseCheckoutBody,
} from "@/lib/stripe/helpers";
import { logError } from "@/lib/utils/log";
import * as Sentry from "@sentry/nextjs";
import { ZodError } from "zod";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured. Please try again later." },
      { status: 503 }
    );
  }

  let payload;
  try {
    payload = parseCheckoutBody(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid payload", issues: error.flatten() },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let priceId: string;
  let successUrl: string;
  let cancelUrl: string;

  try {
    priceId = assertAllowedPriceId(payload.priceId);
    successUrl = assertAllowedReturnUrl(payload.successUrl, "successUrl");
    cancelUrl = assertAllowedReturnUrl(payload.cancelUrl, "cancelUrl");
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }

  const metadata =
    payload.userId && payload.userId.length > 0 ? { userId: payload.userId } : undefined;

  let stripe: Stripe;
  try {
    stripe = getStripeClient();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError("stripe", "checkout client init failed", err);
    Sentry.captureException(err, {
      tags: { scope: "stripe" },
      extra: { phase: "create-checkout-session:init" },
    });
    return NextResponse.json(
      { error: "Stripe backend is not ready. Please contact the administrator." },
      { status: 503 }
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Checkout session missing URL" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url }, { status: 201 });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logError("stripe", "checkout session creation failed", {
      priceId,
      error: err,
    });
    Sentry.captureException(err, {
      tags: { scope: "stripe" },
      extra: {
        phase: "create-checkout-session:create",
        priceId,
        successUrl,
        cancelUrl,
      },
    });
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
