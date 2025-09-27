import { z } from "zod";

const metadataValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const createCheckoutSessionSchema = z.object({
  tierId: z.string().min(1).optional(),
  amount: z.number().int().min(100).max(500000).optional(),
  currency: z.string().min(3).max(3).optional(),
  quantity: z.number().int().min(1).max(10).optional(),
  customerEmail: z.string().email().optional(),
  clientReferenceId: z.string().max(64).optional(),
  metadata: z.record(metadataValueSchema).optional(),
});

export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>;

export function normalizeCurrency(input: string | undefined, fallback: string): string {
  if (!input) return fallback;
  return input.trim().toLowerCase();
}

export function resolveQuantity(value: number | undefined, max: number): number {
  if (!value) return 1;
  if (Number.isNaN(value)) return 1;
  if (value <= 0) return 1;
  if (value > max) return max;
  return value;
}
