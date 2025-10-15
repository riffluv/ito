import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/client";
import {
  allowPromotionCodes,
  billingAddressCollection,
  checkoutCancelUrl,
  checkoutSuccessUrl,
  defaultDonationProductName,
  donationCurrency,
  resolveMaxQuantity,
  requireDonationTier,
} from "@/lib/stripe/config";
import {
  createCheckoutSessionSchema,
  normalizeCurrency,
  resolveQuantity,
} from "@/lib/stripe/payload";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured. Please try again later." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const parseResult = createCheckoutSessionSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parseResult.data;

  const currency = normalizeCurrency(payload.currency, donationCurrency);
  const metadata: Record<string, string> = {};
  if (payload.metadata) {
    for (const [key, value] of Object.entries(payload.metadata)) {
      metadata[key] = String(value);
    }
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  if (payload.tierId) {
    const tier = requireDonationTier(payload.tierId);
    const quantity = resolveQuantity(payload.quantity, resolveMaxQuantity(tier.id));
    metadata.tierId = tier.id;
    lineItems.push({
      price: tier.priceId,
      quantity,
    });
  } else if (payload.amount) {
    const amount = payload.amount;
    metadata.tierId = "custom";
    lineItems.push({
      price_data: {
        currency,
        product_data: {
          name: defaultDonationProductName,
        },
        unit_amount: amount,
      },
      quantity: resolveQuantity(payload.quantity, 10),
    });
  } else {
    return NextResponse.json(
      { error: "Specify tierId or amount" },
      { status: 400 }
    );
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: lineItems,
    success_url: checkoutSuccessUrl,
    cancel_url: checkoutCancelUrl,
    billing_address_collection: billingAddressCollection,
    allow_promotion_codes: allowPromotionCodes,
    metadata,
    client_reference_id: payload.clientReferenceId,
    customer_email: payload.customerEmail,
    automatic_tax: { enabled: true },
  };

  const idempotencyKey = request.headers.get("Idempotency-Key") || randomUUID();

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey,
    });
    return NextResponse.json({ sessionId: session.id, url: session.url }, { status: 201 });
  } catch (error) {
    console.error("[stripe] Failed to create checkout session", error);
    return NextResponse.json(
      { error: "Stripe backend is not ready. Please contact the administrator." },
      { status: 503 }
    );
  }
}






