import { z } from "zod";

type StripeMode = "payment" | "subscription";
type DonationTierConfigInput = {
  id: string;
  name: string;
  env: string;
  mode?: StripeMode;
  quantity?: number;
};

const donationTierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  priceId: z.string().min(1),
  mode: z.union([z.literal("payment"), z.literal("subscription")]).default("payment"),
  quantity: z.number().int().positive().default(1),
});

export type DonationTierConfig = z.infer<typeof donationTierSchema>;

const TIER_DEFINITIONS: DonationTierConfigInput[] = [
  { id: "supporter", name: "Supporter", env: "STRIPE_PRICE_DONATION_SUPPORTER" },
  { id: "champion", name: "Champion", env: "STRIPE_PRICE_DONATION_CHAMPION" },
  { id: "legend", name: "Legend", env: "STRIPE_PRICE_DONATION_LEGEND" },
];

function resolveTierPrice(envName: string): string | null {
  const value = process.env[envName as keyof NodeJS.ProcessEnv];
  if (!value || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

export const donationTiers: DonationTierConfig[] = TIER_DEFINITIONS.flatMap((tier) => {
  const priceId = resolveTierPrice(tier.env);
  if (!priceId) {
    return [];
  }
  return [
    donationTierSchema.parse({
      id: tier.id,
      name: tier.name,
      priceId,
      mode: tier.mode ?? "payment",
      quantity: tier.quantity ?? 1,
    }),
  ];
});

export function findDonationTier(id: string): DonationTierConfig | null {
  return donationTiers.find((tier) => tier.id === id) ?? null;
}

export function requireDonationTier(id: string): DonationTierConfig {
  const tier = findDonationTier(id);
  if (!tier) {
    throw new Error(`Donation tier not configured for id: ${id}`);
  }
  return tier;
}

export function hasDonationTier(id: string): boolean {
  return donationTiers.some((tier) => tier.id === id);
}

export const donationCurrency = (process.env.STRIPE_DONATION_CURRENCY || "jpy").toLowerCase();

export const checkoutSuccessUrl =
  process.env.STRIPE_CHECKOUT_SUCCESS_URL ||
  `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/support/thanks`;

export const checkoutCancelUrl =
  process.env.STRIPE_CHECKOUT_CANCEL_URL ||
  `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/support/cancelled`;

export const defaultDonationProductName =
  process.env.STRIPE_DONATION_PRODUCT_NAME || "Sei no Monshou III Support";

export const allowPromotionCodes = process.env.STRIPE_ALLOW_PROMOTION_CODES !== "false";

export const billingAddressCollection =
  (process.env.STRIPE_BILLING_ADDRESS_COLLECTION as "auto" | "required" | undefined) || "auto";

export function resolveMaxQuantity(tierId: string): number {
  const envKey = "STRIPE_TIER_" + tierId.toUpperCase() + "_MAX_QUANTITY";
  const raw = process.env[envKey as keyof NodeJS.ProcessEnv];
  if (!raw) return 5;
  const parsed = Number(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return 5;
  return parsed;
}
