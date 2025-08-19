# Firebase セットアップガイド（このプロジェクト用）

Firebase コンソール（ホーム）で行う設定と、`.env.local` に書く内容をまとめました。ここだけ見れば最短で動かせます。

## 1. コンソールでやること（順番に）
- プロジェクト作成（または既存プロジェクトを使用）
- Authentication → サインイン方法 →「匿名」有効化
- Firestore → データベースを作成（テスト/本番どちらでも可）
- Realtime Database → データベースを作成（リージョンは任意）
  - RTDB の URL を控える（例: `https://<PROJECT_ID>-default-rtdb.firebaseio.com`）
  - ルールは `rtdb-setup.md` の手順に従って設定
- プロジェクトの概要 → アプリを追加 → ウェブ（</>）を選択
  - 表示される設定オブジェクト（apiKey など）を `.env.local` に転記（下記）

## 2. `.env.local` に書く内容（コピペして値を差し替え）
```
# 必須（Firebase コンソールの Web アプリ設定からコピー）
NEXT_PUBLIC_FIREBASE_API_KEY=xxxxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abcdefg

# 任意（あるなら入れる。無ければ空でOK）
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXX

# RTDB（presence に必須）: RTDB を作成後の「データベース URL」
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
```

保存したら開発サーバを再起動してください。

## 3. RTDB のルールと確認
- ルールは `rtdb-setup.md` の「Step 3」を参照（presence 用の最小構成）
- 2タブで同じ部屋に入って、片方を閉じるともう片方から即座に消えることを確認

## 4. よくあるミスと対処
- `.env.local` の値が空/誤り → アプリが Firebase を初期化できず動きません。コンソールの値を正しく貼り付けて再起動。
- RTDB URL 未設定 → presence が無効になり、退出の反映が遅れます。URL設定後に再起動。
- 匿名ログインが無効 → ルームや presence が読めません。Authentication で「匿名」を有効化。

## 5. 参考（どの値がどこにある？）
- `apiKey`/`authDomain`/`projectId`/`appId` など → コンソールの「アプリを追加（ウェブ）」で表示
- `storageBucket`/`messagingSenderId`/`measurementId` → 同上（ある場合）
- `databaseURL`（RTDB） → Realtime Database 作成後、画面上部に表示

