const uiFlagEnabled =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_STRIPE_UI_ENABLED === "1";

const publishableKey =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
    : "";

/**
 * Stripe UI の露出制御フラグ。 publishable key が設定され、かつ
 * NEXT_PUBLIC_STRIPE_UI_ENABLED=1 のときのみ true。
 */
export const stripeUiEnabled =
  uiFlagEnabled && publishableKey.trim().length > 0;

/**
 * Stripe の公開鍵が設定済みかどうか。
 */
export const stripePublishableConfigured = publishableKey.trim().length > 0;

