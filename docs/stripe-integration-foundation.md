# Stripe 課金基盤 指示書

このドキュメントは、今後の Codex エージェントが UI 実装前に Stripe の内部基盤を構築できるようにするための指示書です。最終的なゴールは「銀行口座・Stripe アカウント情報が揃えば即座に課金体制を稼働できる状態」を作ることです。

## 1. 全体方針
- UI 実装は後回し。まずはサーバー／バックエンドのフローとセキュリティを固める。
- `stripe` npm パッケージは既に依存関係にある（`package.json` 参照）。バージョン差異があればアップデートを検討。
- プロジェクトは Next.js 14 + App Router。API Route（`app/api/.../route.ts`）を利用した実装を基本とする。
- Supabase/Firebase など外部サービスとの連携は必要ない。最初は Stripe 単体で売上管理する。

## 2. 必要な環境変数
`.env.local` または Vercel 環境変数に以下を追加できるよう準備する。

| 名称 | 用途 | 備考 |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Stripe Secret Key | 本番・テストで切り替え見込み。環境毎に設定。 |
| `STRIPE_WEBHOOK_SECRET` | Webhook 署名検証用 | `stripe listen` などで取得。 |
| `STRIPE_PUBLISHABLE_KEY` | フロント用公開キー | UI 実装時に使用予定だが明記しておく。 |
| NEXT_PUBLIC_STRIPE_UI_ENABLED | UI 表示のオン/オフ | 0: 非表示 / 1: 表示 |
| `STRIPE_PRICE_LOOKUP` | 課金アイテムの Price ID | 投げ銭やスキンごとに複数用意する想定（例: `STRIPE_PRICE_DONATION_500` など）。 |

※ `.env.local.example` を用意している場合は上記を追記すること。

## 3. ディレクトリ構成案

```
app/
  api/
    stripe/
      create-checkout-session/route.ts
      webhook/route.ts
lib/
  stripe/
    client.ts      // Stripe SDK 初期化
    helpers.ts     // 共通ロジック（Price 検証、顧客関連など）
```

- `lib/stripe/client.ts` に `new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" })` のような初期化関数を作る。
- 型安全のため `Stripe` 型を import してエクスポート。

## 4. チェックアウトフロー（投げ銭ベース）
1. `POST /api/stripe/create-checkout-session`
   - 受け取るパラメータ例: `{ priceId: string, successUrl: string, cancelUrl: string, userId?: string }`
   - `priceId` は許可リストで検証（`.env` の値や `PRICE_MAP` を利用）。
   - セッション作成例:
     ```ts
     const stripe = getStripeClient();
     const session = await stripe.checkout.sessions.create({
       mode: "payment",
       payment_method_types: ["card"],
       line_items: [{ price: priceId, quantity: 1 }],
       success_url: successUrl,
       cancel_url: cancelUrl,
       metadata: { userId }
     });
     return NextResponse.json({ url: session.url });
     ```
   - `successUrl` / `cancelUrl` はホワイトリスト検証を行う。

2. `POST /api/stripe/webhook`
   - Raw body を `await request.arrayBuffer()` で取得し、`Stripe.webhooks.constructEvent` で署名検証。
   - 想定イベント: `checkout.session.completed`, `payment_intent.succeeded`。
   - 現段階では DB 更新は行わず `console.log` 等で確認する程度でよいが、将来的にインベントリ付与処理を追加できるようコメントを残す。

3. 顧客管理
   - MVP では新規顧客を作成せずセッション完結でも可。
   - スキン販売を見据え `metadata.userId` や `customer_email` を設定し、必要に応じて顧客 ID を保存できる構成を想定しておく。

## 5. セキュリティとバリデーション
- 全 API で zod などを使い入力値を検証。
- Price ID はサーバー側で許可されたリストのみ受け付ける。
- Webhook 署名検証に失敗した場合は `return new Response("invalid signature", { status: 400 })`。
- `successUrl` / `cancelUrl` は自社ドメインのみに限定する。
- エラーハンドリングは Sentry など既存の仕組みがあれば組み込む。

## 6. 動作確認手順
1. `.env.local` に Stripe テストキーを設定。
2. `stripe login` → `stripe listen --forward-to localhost:3000/api/stripe/webhook`。
3. `npm run dev` を起動。
4. `curl` や `Thunder Client` などで `POST /api/stripe/create-checkout-session` を叩き、返ってきた URL でテスト決済。
5. Webhook が受信され、署名検証が通りログ出力されることを確認。
6. 必要なら `stripe test clock` や `stripe trigger payment_intent.succeeded` で動作チェック。

## 7. 将来の拡張ポイント
- スキン課金に向けて `PRICE_MAP` を JSON or TS 定数で管理し、カテゴリ別にフェーズ分け。
- 顧客 ID とアカウント ID の紐付けを Firestore（本プロジェクトで利用している場合）などに保存。
- Webhook で支払い完了を受け取った際にゲーム内資産を付与する関数を用意。
- サブスクリプション導入時には `mode: "subscription"` のフローを追加。

## 8. コードレビューでの着眼点
- 環境変数アクセス時は `process.env.FOO ?? throw` などで存在チェック。
- API Route は TypeScript で、`NextResponse` を返却する形に統一。
- Webhook の Raw Body 取得と検証を忘れず、`Stripe` インスタンスはシングルトンにする。
- `console.log` は開発用。必要に応じて `log.ts` 経由のログにまとめる。

---
この指示書に従えば、Stripe のアカウント情報と価格 ID を揃えることで即座に投げ銭→スキン課金へ拡張できるバックエンド基盤が整います。次の Codex エージェントへは「`docs/stripe-integration-foundation.md` を参照して Stripe 内部実装を進めてください」と伝えてください。