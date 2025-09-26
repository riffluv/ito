# Online ITO - ドラクエ風数字カードゲーム

オンラインマルチプレイヤー協力ゲーム「ITO」のドラゴンクエスト風デザイン実装です。

## 🚀 プロジェクト概要

**公開URL**: https://numberlink.vercel.app/

**完成・デプロイ済み**のリアルタイム協力ゲームで、プレイヤーは数字を見せずにヒントだけで正しい順番を当てることが目標です。

## ✨ 主な特徴

### ゲーム機能
- 🎮 リアルタイムマルチプレイヤー対戦（2-6人）
- 🎯 協力型数字推理ゲーム
- 💬 リアルタイムチャット
- 📱 レスポンシブデザイン（PC・スマホ対応）
- 🎭 匿名ログイン（Firebase Authentication）

### デザイン特徴
- 🐉 **ドラゴンクエスト風UI**（レトロなゲーム感）
- 🌙 **ダークモード専用**（目に優しいゲーミング環境）
- ✨ カード風3Dエフェクト
- 🎨 リッチなグラデーションと影効果

### 技術スタック
- **Frontend**: Next.js 15 + React 18 + TypeScript
- **UI**: Chakra UI v3 (Headless + Panda CSS)
- **Backend**: Firebase Firestore + Authentication
- **Deployment**: Vercel
- **DnD**: dnd-kit（ドラッグ＆ドロップ）
- **Animation**: Framer Motion

## 🎯 ゲーム仕様

### ゲーム流れ
1. **ロビー**: ルーム作成・参加
2. **ヒント入力**: 割り当てられた数字にヒントを設定
3. **順序決定**: ドラッグ＆ドロップで順番を決める
4. **結果確認**: 全員の数字が昇順になっているかチェック
5. **成功/失敗判定**: 協力して正解を目指す

### 解決モード
- **sequential**: 順出し（ドロップしたら即反映）
- **sort-submit**: 並べ提出（並べ終えてから一括提出）

## 🚀 セットアップ

### 1. 依存関係インストール
```bash
npm install
```

### 2. 環境変数設定
`.env.local.example` を `.env.local` にコピーし、Firebase設定を記入：

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project.firebasedatabase.app
# 推奨: RTDB プレゼンスが利用できる環境ではフォールバックを無効化
NEXT_PUBLIC_DISABLE_FS_FALLBACK=1
SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_SENTRY_DSN=your_public_dsn
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0
NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1
NEXT_PUBLIC_ENABLE_PWA=1
```

### 3. Firebase設定
1. [Firebase Console](https://console.firebase.google.com/) でプロジェクト作成
2. **Authentication** で匿名認証を有効化
3. **Firestore** データベースを有効化
4. 開発用に `localhost` を承認済みドメインに追加

### 4. 開発サーバー起動
```bash
npm run dev
```

http://localhost:3000 でアクセス可能

## 🏗️ アーキテクチャ

### ディレクトリ構造
```
├── app/                 # Next.js App Router
├── components/          # Reactコンポーネント
│   ├── ui/             # 再利用可能UIコンポーネント
│   └── site/           # ページ固有コンポーネント
├── lib/                 # ビジネスロジック・ユーティリティ
│   ├── firebase/       # Firebase操作
│   └── game/           # ゲームロジック
├── theme/              # Chakra UIテーマ設定
└── docs/               # プロジェクトドキュメント
```

### Firestore構造
```
rooms/{roomId}
├── 基本情報: name, hostId, status, options
├── players/{playerId}: name, number, clue1, clue2, ready
└── chat/{messageId}: sender, text, createdAt
```

## 🎨 開発情報

### コード品質
- TypeScript完全対応
- ESLint設定済み
- Firebase Security Rules適用済み
- レスポンシブデザイン対応

### パフォーマンス最適化
- リアルタイムデータ同期（Firestore）
- 効率的なレンダリング（React 18 Concurrent Features）
- モバイル最適化済み

## 📚 関連ドキュメント

- `docs/GAME_LOGIC_OVERVIEW.md` - ゲームロジック詳細仕様
- `claudedocs/vercel-firebase-setup.md` - デプロイ設定手順

## 🌟 今後の拡張可能性

- 🔊 BGM・効果音の追加
- 🖼️ ロゴ画像・カードイラスト
- 🎭 キャラクターアバター
- 📊 プレイ統計・ランキング機能
- 🌍 多言語対応

---

**開発者向け**: このプロジェクトは完成済みです。追加機能や改修の際は、既存の設計パターンを踏襲してください。
