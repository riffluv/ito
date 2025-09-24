# ログ設定ガイド

このプロジェクトでは `lib/utils/log.ts` に定義されている `logDebug` / `logInfo` / `logWarn` / `logError` を通じてログを出力します。ログレベルは環境変数で切り替え可能です。

| 対象 | 参照する環境変数 | 備考 |
|------|-------------------|------|
| サーバー (Next.js API / Cloud Functions など) | `LOG_LEVEL` → フォールバックで `NEXT_PUBLIC_LOG_LEVEL` | デフォルトは `info` |
| ブラウザ (クライアント) | `NEXT_PUBLIC_LOG_LEVEL` | デフォルトは `info` |

## 使い方

### 1. 開発環境

`.env.local` 等に以下を記述すると、表示したいログレベルを簡単に切り替えられます。

```env
LOG_LEVEL=debug
NEXT_PUBLIC_LOG_LEVEL=warn
```

上記設定ではサーバー側では `debug` 以上、クライアント側では `warn` 以上のログのみ出力されます。

### 2. 本番環境

- **Vercel**: プロジェクトの *Environment Variables* に `LOG_LEVEL` を追加します。
- **Firebase Functions**: `firebase functions:config:set log.level="warn"` のように環境変数を設定すると、関数内で `process.env.LOG_LEVEL` として参照できます。


### 3. Cloud Logging との連携

`console.debug/info/warn/error` の出力は GCP の Cloud Logging でそのまま `severity` として処理されます。必要に応じてログエクスプローラーで `resource.type="cloud_function" AND labels.scope="rooms"` などのフィルタを設定しておくと、`leaveRoomServer` など重要 API の挙動を簡単に監視できます。

## ログレベル一覧

- `silent` : すべてのログを抑止
- `error`  : `logError` のみを出力
- `warn`   : `logWarn` / `logError`
- `info`   : `logInfo` 以上を出力（デフォルト）
- `debug`  : すべてのログを出力

フロントエンドで `NEXT_PUBLIC_LOG_LEVEL` を設定していない場合、サーバー側の `LOG_LEVEL` は自動継承されません。必要に応じて両方に同じ値を設定してください。
