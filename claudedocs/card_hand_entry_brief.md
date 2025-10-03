# 手札エントリー演出 実装指示書

## 目的
- ルームに入ってすぐカードが並んでいる現状を見直し、「ゲーム開始」操作に合わせて手札が飛んでくる演出を追加する。
- UX を高めつつ、低スペック環境所 PC を含む低スペック端末でも既存と同等のパフォーマンスを維持する。

## 現状の前提
- 手札表示は常時マウントされており、`MiniHandDock` などの下流に `DiamondNumberCard` が並ぶ構造。
- 「せーの！」ボタン周りは `SeinoButton` コンポーネント化済みで、GSAP の `fromTo` を transform/opacity だけに絞った実装になっている。
- 既存の GSAP 設定は低スペック端末でも発火する（純粋な GSAP のみ使用）。この制約は今後も守ること。

## やりたい体験フロー
1. **ロビー／待機中**：カードは画面に見せない。代わりにスケルトンや「準備中」インジケータを出す。
2. **バックグラウンドでの事前準備**
   - 画像・フォント・SE をプリロード（`new Image().src` / `image.decode()` / `<link rel="preload">`）。
   - React コンポーネントは `visibility: hidden; pointer-events: none;` でマウントしておき、レイアウトを先に確定させる。
3. **ゲーム開始操作（ホスト or 自動開始）**
   - 可視化フラグを立て、`visibility: visible` に切り替える。
   - 同時に手札カードを山札位置から手札位置へ飛ばす GSAP アニメを発火。
4. **アニメーション仕様**
   - プロパティは transform (`x`,`y`,`rotation`,`scale`) と `opacity` のみに限定。
   - `duration: 0.28〜0.38s` 程度、`ease: "back.out(1.4)"` を基本に。
   - `stagger: 0.05〜0.08` で 1 枚ずつディレイ。手札インデックス順に並ぶこと。
   - 出発点は山札／中央上部など 1 箇所に固定。`gsap.fromTo` の `from` で `x`,`y` を相対指定（例: `{ x: -deckOffsetX, y: -deckOffsetY }`）。
   - 着地後は transform をリセット（`clearProps: "transform,opacity"` など）し、平時の描画と干渉しないようにする。

## 実装タスク案
1. **可視状態の制御**
   - 手札コンテナに `isHandVisible` のようなステートを追加（ゲーム開始時に true）。
   - `prefers-reduced-motion` を検出し、該当ユーザーはフェードインのみ（アニメーションをスキップ）。
2. **プリロードユーティリティ**
   - `useEffect` でルーム入室直後にカード画像/フォントを読み込むフックを追加。
   - 既存の `DiamondNumberCard` で使うアセットリストがある場合は流用。なければ `CARD_IMAGE_URLS` のような定数を定義。
3. **GSAP キュー**
   - `useGSAP` などは導入せず、既存方針通り `gsap.context` + `fromTo` を使用。
   - `ref` で手札の DOM ラッパー（例: `<Box ref={handRef}>`）を掴み、子要素に `.hand-card` のクラスを付与して対象を一括取得。
   - アニメーション終了後に `pointer-events` を `auto` に戻す。
4. **待機 UI**
   - 待機中は `HandSkeleton`（簡易な Box 群）を表示して、レイアウトギャップを感じさせない。
   - スケルトンは `isHandVisible` が true になったタイミングでフェードアウト。

## 非機能要件・制約
- **純GSAPのみ**：他のアニメーションライブラリや CSS アニメは導入しない。
- **低スペック端末対応**：transform/opacity 以外をアニメーションしない。`filter` の使用も禁止。
- **アクセシビリティ**：`prefers-reduced-motion` でアニメーションをスキップし、代わりに 150ms 程度のフェードに切り替える。
- **再入室/リセット**：`isHandVisible` の初期化とアニメ繰り返しを考慮。ラウンド再開時にも同じ演出を再利用できる状態に。

## テスト観点
- 待機中はカード非表示／スケルトン表示になっているか。
- ゲーム開始時にカードが順番に飛んでくるか（順序・位置ずれがないか）。
- `prefers-reduced-motion` 設定のブラウザでフェードのみになるか。
- 低スペック想定（Chrome DevTools の CPU スロットリングなど）でもフレームドロップが許容範囲か。
- リセット後の再配布でも同じ演出が二重再生せず正常に走るか。

## 参考ファイル
- `components/ui/MiniHandDock.tsx`（手札操作 UI 実装）
- `components/ui/DiamondNumberCard.tsx`（カード表示コンポーネント）
- `components/ui/SeinoButton.tsx`（GSAP + context の書き方参考）
- `app/rooms/[roomId]/page.tsx`（ラウンド開始判定、`pop` ステート等）

上記を前提に、Claude Code へ実装を依頼してください。
