# Stripe 決済基盤セットアップ

このドキュメントは序の紋章III（Next.js）プロジェクトで Stripe を安全に運用するための基本手順をまとめたものです。

## 必須環境変数
`.env.local` に以下を設定してください。

```
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_CHECKOUT_SUCCESS_URL=https://example.com/support/thanks
STRIPE_CHECKOUT_CANCEL_URL=https://example.com/support/cancelled
STRIPE_DONATION_CURRENCY=jpy
STRIPE_DONATION_PRODUCT_NAME=Sei no Monshou III Support
STRIPE_PRICE_DONATION_SUPPORTER=price_xxx
STRIPE_PRICE_DONATION_CHAMPION=price_xxx
STRIPE_PRICE_DONATION_LEGEND=price_xxx
```

必要に応じて以下を上書きできます。

```
STRIPE_API_VERSION=2024-09-30.acacia
STRIPE_ALLOW_PROMOTION_CODES=true
STRIPE_BILLING_ADDRESS_COLLECTION=required
STRIPE_TIER_SUPPORTER_MAX_QUANTITY=5
STRIPE_TIER_CHAMPION_MAX_QUANTITY=5
STRIPE_TIER_LEGEND_MAX_QUANTITY=2
```

## 開発フロー

1. `npm run dev` で Next.js を起動。
2. Stripe CLI を使用し、次のコマンドでローカルに Webhook を転送。
   ```
   npm run stripe:listen
   ```
3. テスト決済を再現する場合は次を実行。
   ```
   npm run stripe:trigger-checkout
   ```

## 決済 API

- `POST /api/payments/create-checkout-session`
  - `tierId` で定義済みプランを指定するか、`amount` で単発寄付額（最小 100、最大 500000）を指定。
  - 応答には `sessionId` と Stripe の `url` が返るため、フロントエンドで `window.location.href = url` などで遷移します。
- `POST /api/webhooks/stripe`
  - Stripe からのイベント通知を受信し、重複処理を防ぐため Firestore (admin) に `stripe_events/{eventId}` ドキュメントを作成します。
  - `checkout.session.completed` / `payment_intent.succeeded` をハンドリング済み。追加ロジックは `lib/stripe/webhookHandlers.ts` に実装します。

## ベストプラクティス

- 料金計算は常にサーバー内で行い、クライアントから送られた値を信用しない。
- Idempotency-Key を利用し、再送時の重複 Checkout セッション生成を防止。
- Webhook では署名検証と Firestore へのイベント保存を行い、冪等性を担保する。
- `stripe` SDK はサーバー専用に `lib/stripe/client.ts` で生成し、グローバルキャッシュする。
- Stripe CLI を使ってローカルで Webhook を検証し、デプロイ前にフロー全体を確認。
