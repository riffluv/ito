# Realtime Database（RTDB）最小設定ガイド

このプロジェクトで「参加/退出を即時反映」させるための RTDB presence 機能の最小設定手順です。

## 1. 前提
- Firebase プロジェクトが作成済み（本アプリが Firestore で動いている状態）
- Authentication の「匿名ログイン」が有効（ロビー/部屋は匿名ログインで利用します）

## 2. RTDB を有効化
1. Firebase コンソール → Realtime Database → データベースを作成
2. ロケーションは任意（例: `us-central1`）。
3. 作成後、データベースURLを確認（例: `https://<PROJECT_ID>-default-rtdb.firebaseio.com` または リージョン付きURL）。

## 3. 環境変数を設定
ルートの `.env.local` に RTDB の URL を追加します。

```
NEXT_PUBLIC_FIREBASE_DATABASE_URL="https://<PROJECT_ID>-default-rtdb.firebaseio.com"
```

保存後、開発サーバを再起動してください。

## 4. RTDB ルール（最小）
presence 用に、以下のルールを設定します。

```
{
  "rules": {
    ".read": false,
    ".write": false,
    "presence": {
      "$roomId": {
        ".read": "auth != null", // ロビー/部屋でオンライン人数・一覧を取得
        "$uid": {
          ".write": "auth != null && auth.uid === $uid" // 自分のpresenceだけ書ける
        }
      }
    }
  }
}
```

補足:
- 「誰でも人数を見られてOK」にする場合は `.read` を `true` にしても構いません（匿名ログインを使うなら `auth != null` のままでもOK）。
- onDisconnect.remove はサーバ側で発火しますが、直前のクライアントの認証状態で評価されるため上記の書き込みルールで動作します。

## 5. 仕組み（簡単に）
- 入室時に `presence/<roomId>/<uid> = { online: true, ts: ServerTimestamp }` を書き込み、`onDisconnect().remove()` を登録します。
- 退出（ボタン/タブ閉）で presence を削除。突然の切断でも `onDisconnect` により即削除されます。
- ロビー/部屋は `presence/<roomId>` を subscribe してオンラインユーザーを即時表示します。

## 6. 動作確認
1. ローカルで開発サーバを再起動
2. 同一ルームをブラウザ2タブで開く
3. 片方で「退出」やタブ閉じ → もう片方の一覧から即座に消えることを確認

## 7. トラブルシューティング
- 退出しても残る: `.env.local` の `NEXT_PUBLIC_FIREBASE_DATABASE_URL` が誤っていないか、dev再起動したか確認。
- 参照エラー/白画面: RTDB未設定でもフォールバックで動くように実装済みですが、consoleerror.md の内容を共有ください。
- ルールで弾かれる: Authentication の匿名ログインが無効だと `auth == null` になります。匿名ログインを有効化して再度確認してください。

---
この設定で presence が有効になり、ロビー退出後にリストへ残る問題がほぼ解消されます。さらに厳密にしたい場合は、presence の `.read` を部屋の参加者のみに限定するなど、要件に合わせて調整してください。

