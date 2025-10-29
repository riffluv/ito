declare namespace NodeJS {
  interface ProcessEnv {
    STRIPE_SECRET_KEY?: string;
    STRIPE_PUBLISHABLE_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    STRIPE_API_VERSION?: string;
    STRIPE_CHECKOUT_SUCCESS_URL?: string;
    STRIPE_CHECKOUT_CANCEL_URL?: string;
    STRIPE_DONATION_CURRENCY?: string;
    STRIPE_DONATION_PRODUCT_NAME?: string;
    STRIPE_ALLOW_PROMOTION_CODES?: string;
    STRIPE_BILLING_ADDRESS_COLLECTION?: "auto" | "required";
    STRIPE_PRICE_DONATION_SUPPORTER?: string;
    STRIPE_PRICE_DONATION_CHAMPION?: string;
    STRIPE_PRICE_DONATION_LEGEND?: string;
    NEXT_PUBLIC_APP_URL?: string;
    NEXT_PUBLIC_APP_VERSION?: string;
  }
}
