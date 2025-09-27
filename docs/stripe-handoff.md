# 次エージェント引き継ぎ（Stripe基盤）

## 現状概要
- Next.js プロジェクトに Stripe 決済のサーバー基盤を導入済み（Checkout セッション作成 API + Webhook 受信）
- Firestore を利用した Stripe イベントの冪等管理を組み込んでおり、重複通知を自動で弾く構成
- Webhook ハンドラはログ記録のみのプレースホルダーで、実ビジネスロジックは未実装
- ドキュメント docs/stripe.md に環境変数や運用フローをまとめ済み

## 今後の優先タスク
1. Stripe ダッシュボードで寄付プラン（Price / Product）と Webhook 秘密鍵を作成し、.env.local に反映
2. lib/stripe/webhookHandlers.ts に寄付処理（領収書送付、特典付与など）を実装
3. Firestore 利用が難しい環境の場合に備えて、冪等ストアの代替実装方針を検討
4. テスト（Stripe CLI を使った手動検証 + モックを用いたユニット/統合テスト）を整備し CI に組み込み

## 動作確認メモ
- 
pm run dev でアプリを起動
- 
pm run stripe:listen でローカル Webhook を Stripe から転送
- 
pm run stripe:trigger-checkout でテストイベントを発火し、Webhook ログと Firestore への記録を確認

## 依存ファイル一覧
- API: pp/api/payments/create-checkout-session/route.ts
- Webhook: pp/api/webhooks/stripe/route.ts
- Stripe クライアント: lib/stripe/client.ts
- 設定リゾルバ: lib/stripe/config.ts
- Webhook ハンドラ: lib/stripe/webhookHandlers.ts
- イベントストア: lib/server/stripeEventStore.ts
- ドキュメント: docs/stripe.md
- 環境変数型定義: 	ypes/env.d.ts

## 注意事項
- STRIPE_SECRET_KEY 等が未設定の状態では API ルートがエラーを返すため、本番前に必ず環境変数を確認
- Checkout 作成 API は 	ierId か mount のどちらか必須。クライアント側でのバリデーション実装時に仕様を揃えること
- Webhook では Next.js App Router の生ボディ取得を利用。Pages Router へ移行する場合は bodyParser を無効化する設定が必要
- 将来的に寄付以外の決済を追加する場合は、lib/stripe 配下でユースケースごとにモジュールを分割することを推奨
