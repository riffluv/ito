import { z } from "zod";

const PRICE_ENV_PREFIX = "STRIPE_PRICE_";
const RETURN_URL_ENV = "STRIPE_ALLOWED_RETURN_URLS";

const createCheckoutBodySchema = z.object({
  priceId: z.string().min(1, "priceId is required"),
  successUrl: z.string().url("successUrl must be a valid URL"),
  cancelUrl: z.string().url("cancelUrl must be a valid URL"),
  userId: z.string().min(1).optional(),
});

export type CreateCheckoutBody = z.infer<typeof createCheckoutBodySchema>;

function parseJsonList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === "string");
    }
    if (parsed && typeof parsed === "object") {
      return Object.values(parsed).filter((entry): entry is string => typeof entry === "string");
    }
  } catch {
    // noop: fallback to comma split
  }
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function collectAllowedPriceIds(): Set<string> {
  const priceIds = new Set<string>();
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(PRICE_ENV_PREFIX)) {
      continue;
    }
    if (!value) {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      priceIds.add(trimmed);
    }
  }

  const lookupEnv = process.env.STRIPE_PRICE_LOOKUP;
  if (lookupEnv && lookupEnv.trim().length > 0) {
    for (const entry of parseJsonList(lookupEnv.trim())) {
      if (entry.length > 0) {
        priceIds.add(entry);
      }
    }
  }

  return priceIds;
}

const allowedPriceIds = collectAllowedPriceIds();

function resolveAllowedReturnOrigins(): string[] {
  const whitelistSource =
    process.env[RETURN_URL_ENV as keyof NodeJS.ProcessEnv] ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  return parseJsonList(whitelistSource)
    .map((entry) => {
      try {
        return new URL(entry).origin;
      } catch {
        return null;
      }
    })
    .filter((origin): origin is string => Boolean(origin));
}

const allowedReturnOrigins = new Set(resolveAllowedReturnOrigins());

export function parseCheckoutBody(data: unknown): CreateCheckoutBody {
  const result = createCheckoutBodySchema.safeParse(data);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

export function assertAllowedPriceId(priceId: string): string {
  if (allowedPriceIds.size === 0) {
    throw new Error("No Stripe Price IDs configured");
  }
  if (!allowedPriceIds.has(priceId)) {
    throw new Error("Price ID is not allowed");
  }
  return priceId;
}

function resolveOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    throw new Error("URL must include protocol and host");
  }
}

export function assertAllowedReturnUrl(url: string, fieldName: "successUrl" | "cancelUrl"): string {
  const origin = resolveOrigin(url);
  if (!allowedReturnOrigins.has(origin)) {
    throw new Error(`${fieldName} is not in the allowlist`);
  }
  return url;
}

export function getAllowedPriceIds(): string[] {
  return Array.from(allowedPriceIds);
}

export function getAllowedReturnOrigins(): string[] {
  return Array.from(allowedReturnOrigins);
}
