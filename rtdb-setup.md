# Realtime Database（RTDB）設定ガイド（presence 用）

このプロジェクトでは、プレイヤーの入室/退室を「即時反映」させるために Realtime Database（以下 RTDB）を presence 用として使用します。以下の手順に沿って設定してください。

## 1. 目的と前提
- 目的: 部屋/ロビーの参加者一覧や人数をリアルタイムに更新する
- 前提:
  - Firebase プロジェクトが作成済みで、Firestore 連携は動作している
  - Authentication の「匿名ログイン」が有効

## 2. 全体の流れ（まずは概要）
1) RTDB を有効化して URL を取得する
2) `.env.local` に RTDB の URL を追記する
3) RTDB のセキュリティルールを設定する
4) 開発サーバを再起動し、2タブで入退室を確認する

---

## 3. 手順（ステップバイステップ）

### Step 1: RTDB を有効化
1. Firebase コンソール → Realtime Database →「データベースを作成」
2. リージョンは任意（例: `us-central1`）
3. 作成後、「データベース URL」を控える
   - 例: `https://<PROJECT_ID>-default-rtdb.firebaseio.com`
   - リージョン付きの URL でも問題ありません

### Step 2: `.env.local` に URL を設定
プロジェクト直下の `.env.local` に以下を追記（または値を置き換え）します。

```
NEXT_PUBLIC_FIREBASE_DATABASE_URL="https://<PROJECT_ID>-default-rtdb.firebaseio.com"
```

保存したら、Next.js の開発サーバを再起動してください。

### Step 3: RTDB のセキュリティルールを設定
presence 用に最小限のルールを設定します（コンソールの「ルール」タブから設定）。

```
{
  "rules": {
    ".read": false,
    ".write": false,
    "presence": {
      "$roomId": {
        ".read": "auth != null", // ロビー/部屋でオンライン人数・一覧を取得
        "$uid": {
          ".write": "auth != null && auth.uid === $uid" // 自分の presence のみ書き込み可
        }
      }
    }
  }
}
```

補足:
- 誰でもオンライン人数を見られて構わない場合は、`"presence/$roomId"` の `".read"` を `true` にしても構いません。
- `onDisconnect().remove()` はサーバ側で実行され、直前の認証状態が使われます。上記ルールで問題なく動作します。

### Step 4: 開発サーバを再起動
環境変数とルールの反映後、必ず開発サーバ（`yarn dev` など）を再起動してください。

---

## 4. 仕組み（どう動くか）
- 入室時（タブ単位）: `presence/<roomId>/<uid>/<connId>` に `{ online: true, ts: ServerTimestamp }` を書き込み、`onDisconnect().remove()` を登録
  - 同じユーザーが複数タブを開いても、それぞれ別の `connId` として管理されます（片方のタブを閉じてももう片方は残ります）
- 退出/タブ閉: 対応する `connId` ノードが自動削除され、他クライアントにも即座に反映
- 表示側: `presence/<roomId>` を購読し、各 `uid` に 1 つ以上の `connId` が存在する場合に「オンライン」とみなして人数・一覧を更新
- フォールバック: RTDB が使えない場合でも、Firestore の `lastSeen` で近接（数十秒以内）をオンライン扱いとして表示

---

## 5. 動作確認（必須）
1) 開発サーバを再起動する
2) 同じ部屋をブラウザ 2 タブ（通常/シークレット）で開く
3) 片方で「退出」またはタブを閉じる
4) もう片方の「参加者」一覧から相手が即座に消えることを確認（presence が有効なら瞬時、フォールバック時は最大 ~20 秒）

---

## 6. うまくいかないとき（チェックリスト）
- URL 設定: `.env.local` の `NEXT_PUBLIC_FIREBASE_DATABASE_URL` は正しいか
- ルール: 上記ルールを RTDB に適用しているか（`.read/.write` と `presence` 配下の条件）
- 認証: Authentication で「匿名ログイン」が有効になっているか
- 再起動: `.env.local` 変更後に開発サーバを再起動したか
- ネットワーク: ブラウザのコンソール/ネットワークタブに RTDB への接続エラーが出ていないか

---

## 7. よくある質問（FAQ）
- Q. 退出しても一覧から消えません
  - A. URL とルールを再確認し、`.env.local` 変更後に開発サーバを再起動してください。presence が無効でも数十秒で `lastSeen` により消えます。
- Q. オンライン人数は誰でも見られますか？
  - A. 既定ルールでは `auth != null` のユーザーのみが `presence` を読めます。公開したい場合は `".read": true` に変更してください。
- Q. 一部のユーザーだけ presence を見せたい
  - A. ルール式を部屋参加者コレクションに紐付ける等で厳密化できます（要件次第で拡張）。

---

## 8. 参考（少し厳密なルール例）
「部屋に参加しているユーザーだけ読める」にしたい場合のイメージ（擬似例）。実際の Firestore/RTDB 構造に合わせて調整してください。

```
{
  "rules": {
    "presence": {
      "$roomId": {
        ".read": "auth != null", // ここを部屋参加者判定に差し替え可
        "$uid": {
          ".write": "auth != null && auth.uid === $uid"
        }
      }
    }
  }
}
```

---

以上で RTDB（presence）の設定は完了です。この設定により、入室/退室が部屋とロビーに即座に反映されます。
scoop search googler
