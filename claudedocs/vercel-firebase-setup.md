# Vercel + Firebase デプロイ設定手順

## 1. Vercel 環境変数の設定

### 手順
1. [Vercel Dashboard](https://vercel.com/dashboard) にログイン
2. デプロイしたプロジェクトをクリック
3. **Settings** タブをクリック
4. 左サイドバーの **Environment Variables** をクリック
5. 以下の環境変数を1つずつ追加：

### 追加する環境変数
```
Name: NEXT_PUBLIC_FIREBASE_API_KEY
Value: AIzaSyC6AZfNZYB8R53laqA9SyOrFqIe0U8Cnxs

Name: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
Value: online-ito.firebaseapp.com

Name: NEXT_PUBLIC_FIREBASE_PROJECT_ID
Value: online-ito

Name: NEXT_PUBLIC_FIREBASE_APP_ID
Value: 1:374128501058:web:ae672cc7dc71a60c4e28db

Name: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
Value: online-ito.appspot.com

Name: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
Value: 374128501058

Name: NEXT_PUBLIC_FIREBASE_DATABASE_URL
Value: https://online-ito-default-rtdb.asia-southeast1.firebasedatabase.app
```

### 注意点
- **Environment** は `Production`, `Preview`, `Development` 全て選択
- 各変数を追加後、必ず **Save** をクリック

## 2. Firebase Console 設定

### A. Authentication の設定
1. [Firebase Console](https://console.firebase.google.com/) で `online-ito` プロジェクトを開く
2. **Authentication** → **Settings** → **Authorized domains**
3. **Add domain** をクリック
4. VercelのデプロイURL（例：`your-app-name.vercel.app`）を追加
5. **Done** をクリック

### B. 匿名認証の有効化
1. **Authentication** → **Sign-in method**
2. **Anonymous** をクリック
3. **Enable** をオンにして **Save**

### C. Firestore Rules の修正
**現在のルールは Realtime Database 用です。Firestore 用に変更が必要：**

1. **Firestore Database** → **Rules**
2. 以下のルールに置き換え：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 認証済みユーザーのみアクセス可能
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. **Publish** をクリック

## 3. 再デプロイ

環境変数を設定したら必ず再デプロイが必要：

1. Vercel Dashboard の **Deployments** タブ
2. 最新のデプロイの **...** → **Redeploy**
3. **Redeploy** をクリック

## 4. 動作確認

デプロイ完了後：
1. VercelのURLにアクセス
2. 名前入力画面で名前を設定
3. ルーム作成・参加ができるかテスト

## トラブルシューティング

### よくあるエラーと解決方法

**エラー**: `FirebaseError: Missing or insufficient permissions`
**解決**: Firestore Rules が正しく設定されているか確認

**エラー**: `Auth domain not whitelisted`
**解決**: Firebase Authentication の Authorized domains に Vercel URL を追加

**エラー**: 環境変数が undefined
**解決**: Vercel で環境変数設定後、再デプロイが必要

**エラー**: Anonymous authentication is disabled
**解決**: Firebase Authentication で Anonymous を有効化

## 完了チェックリスト

- [ ] Vercel に全ての環境変数を追加
- [ ] Firebase Authentication で Vercel URL を承認済みドメインに追加  
- [ ] Firebase Authentication で匿名認証を有効化
- [ ] Firestore Rules を正しく設定
- [ ] Vercel で再デプロイ実行
- [ ] 動作確認完了

これで Vercel + Firebase の設定は完了です！

## 📝 重要な注意事項

### 開発環境への影響について

**心配無用！開発環境での対戦テストは引き続き可能です。**

#### なぜ大丈夫なのか？

1. **環境の分離**
   - **開発サーバー** (`npm run dev`) → `.env.local`の設定を使用
   - **Vercel本番** → Vercelダッシュボードの環境変数を使用
   - 両者は独立しているため、Vercel設定は開発環境に影響しません

2. **同じFirebaseプロジェクトを使用**
   - 開発環境もVercel本番も同じ`online-ito`Firebaseプロジェクト
   - データベースは共有されるため、どちらからでも対戦可能

3. **承認済みドメインの確認**
   Firebase Console で以下が設定されているはず：
   - `localhost` (開発用) ← 既存
   - `online-ito.firebaseapp.com` (Firebase hosting用) ← 既存
   - `your-app.vercel.app` (Vercel用) ← 新規追加

#### テスト環境の使い分け

- **開発テスト**: Chrome + シークレットモードでの対戦テスト → 引き続き利用可能
- **本番テスト**: VercelのURLでの対戦テスト → 新たに利用可能

どちらも同じFirebaseプロジェクトを使用するため、データは共有されます。

**結論：開発環境での対戦テストは従来通り動作します！安心してVercel設定を進めてください。**