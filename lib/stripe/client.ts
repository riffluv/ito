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

function createStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || secretKey.trim().length === 0) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  return new Stripe(secretKey, {
    apiVersion: resolveApiVersion(),
    appInfo: {
      name: STRIPE_APP_NAME,
      version: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
      url: process.env.NEXT_PUBLIC_APP_URL,
    },
    maxNetworkRetries: 2,
    timeout: 20000,
  });
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.trim().length > 0);
}

export function getStripeClient(): Stripe {
  if (!globalStripe.__STRIPE_CLIENT__) {
    globalStripe.__STRIPE_CLIENT__ = createStripeClient();
  }
  return globalStripe.__STRIPE_CLIENT__;
}
