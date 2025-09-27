import Stripe from "stripe";

const DEFAULT_API_VERSION = "2025-08-27.basil" as const;
const STRIPE_APP_NAME = "Sei no Monshou III";

const globalStripe = globalThis as typeof globalThis & {
  __STRIPE_CLIENT__?: Stripe;
};

function resolveApiVersion(): Stripe.StripeConfig["apiVersion"] {
  const configured = process.env.STRIPE_API_VERSION as Stripe.StripeConfig["apiVersion"] | undefined;
  if (!configured || configured.trim().length === 0) {
    return DEFAULT_API_VERSION;
  }
  return configured;
}

function ensureStripeClient(): Stripe {
  if (globalStripe.__STRIPE_CLIENT__) {
    return globalStripe.__STRIPE_CLIENT__;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || secretKey.trim().length === 0) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  const client = new Stripe(secretKey, {
    apiVersion: resolveApiVersion(),
    appInfo: {
      name: STRIPE_APP_NAME,
      version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
      url: process.env.NEXT_PUBLIC_APP_URL,
    },
    maxNetworkRetries: 2,
    timeout: 20000,
  });

  globalStripe.__STRIPE_CLIENT__ = client;
  return client;
}

export const stripe = ensureStripeClient();

export function getStripeClient(): Stripe {
  return ensureStripeClient();
}
