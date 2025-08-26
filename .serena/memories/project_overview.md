# ITOアプリプロジェクト概要

## プロジェクトの目的
日本の協力型パーティゲーム「ITO（イト）」をオンラインで実装したNext.jsアプリケーション。プレイヤーが1-100の数字カードを持ち、お題に沿った表現で数字を伝え、協力して昇順に並べることを目指す。

## 技術スタック
- **フレームワーク**: Next.js 14.2.5 + React 18.2.0
- **UI ライブラリ**: Chakra UI v3.25.0
- **スタイリング**: Next Themes, Lucide React Icons
- **ドラッグ&ドロップ**: @dnd-kit
- **バックエンド**: Firebase (Firestore)
- **テスト**: Jest + Testing Library
- **言語**: TypeScript 5.9.2

## プロジェクト構造
```
├── app/               # Next.js App Router
├── components/        # UI コンポーネント
├── context/          # React Context
├── docs/             # ドキュメント
├── lib/              # ユーティリティ
├── public/           # 静的ファイル
├── theme/            # Chakra UI テーマ
├── types/            # TypeScript 型定義
└── __tests__/        # テストファイル
```

## ゲームの特徴
- 2種類のゲームモード：逐次判定（Sequential）と一括判定（Sort-Submit）
- リアルタイム通信でマルチプレイヤー対応
- Chakra UI v3による現代的なUI設計
- レスポンシブデザイン（フルスクリーン固定レイアウト）