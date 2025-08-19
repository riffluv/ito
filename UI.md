# ito-ui-and-bugfix-spec.md
## 目的
- 画面が詰まりすぎて視認性が悪い現状を解消する（スクリーンショット参照: `/mnt/data/itoUI.png` を参考に）。  
- Firestore に保存されていない（画面に出ない）**お題 (topic)** を確実に表示・保存するよう修正する。  
- 既に決まっているルール変更（「ヒント」→「連想ワード」、1ワードのみ、何度でも更新可）を反映する。  
- ホスト確定・Reveal UX などのルールは別仕様ファイルにあるため、それに整合する形で UI を整理する。

---

## ゴール（Acceptance Criteria）
1. 画面の主要要素が「読みやすく」「操作しやすく」「モバイルで縦積み」になること。  
2. ルームの `topic` が常に画面上に表示される（作成時に `topicOptions` が作られ、ホストが選ぶと `rooms/{roomId}.topic` に永続化される）。  
3. 「連想ワード」ラベルに統一され、各プレイヤーの `clue` が即時全員に見える。連想ワードは何度でも更新可。  
4. ホストの「順序確定」ボタンがわかりやすく配置され、押すと確認ダイアログ→`status='reveal'` となる。  
5. Reveal の演出（低い順にハイライトして数字表示）は別仕様ファイルに沿って実装される（簡易実装でOK）。  
6. 既存の機能（チャット、匿名ログイン、Firestore 読み書き）を壊さない。  
7. レスポンシブ（幅1200px 以上はデスクトップレイアウト、幅<900px では縦積み）および `prefers-reduced-motion` に対応。

---

## 変更方針（要約）
- レイアウトを右詰め・詰め込み型から「3カラム（大画面）→2カラム（中）→縦積み（小）」に変更する。  
- 主要 UI（左: プレイヤー、中央: トピック/連想ワード/Order、下: チャット）に整理。  
- 「オプション」トグル類はサイドに小さくまとめる。不要な「追加ヒント」「2個ヒント設定」は UI から削除。  
- Firestore の `rooms/{roomId}` に `topic` と `topicOptions` を確実に保存・監視する（既存の room creation ロジックを修正）。  
- 現行 UI を壊さないよう、既存ファイルを更新する差分パッチ形式で実装。

---

## 期待する出力（生成ファイル・差分）
- `components/TopicDisplay.tsx` — 現在の部屋トピックと topicOptions を表示し、ホスト向け選択UIを含む
- `components/PlayersList.tsx` — プレイヤーカードの余白/フォント調整、avatar と連想ワードを見やすく
- `components/CluePanel.tsx` — 「連想ワード」入力欄（ラベル変更・何度でも更新可能）
- `components/OrderBoard.tsx` — 並べ替え領域（ドラッグではなく一時的に上/下ボタンでも可）、確定ボタン + 確認ダイアログ
- `app/room/[roomId]/page.tsx` or `pages/rooms/[roomId].tsx` — レイアウトを `Grid` に組み替え、上記コンポーネントを配置
- `styles/room.css` もしくは Chakra テーマ更新（spacing, card styles, breakpoints）
- `lib/firebase.ts`（既存）へ room creation 時の `topicOptions` 保存処理を追加（`pickTwoTopcis()`）
- `firestore.rules`（必要な修正があれば） — topic 関連の write をホストに限定するなど
- `README.md` に「UI テスト手順」「複数端末でのテスト方法」記載
- できれば小さなスクリーンショット(改善前→改善後)を作るテストケース（手順として説明）

---

## 詳細指示（フロントエンド）
### A. レイアウト（デスクトップ：幅 >= 1200px）
- 全体 `max-width: 1200px; margin: 0 auto; padding: 24px`
- グリッド: `grid-template-columns: 300px 1fr 320px; grid-gap: 20px;`
  - 左カラム (300px): `PlayersList`（プレイヤー一覧、少し大きめのアバター、名前、連想ワード、参加状態）
  - 中央カラム (fluid): トピック表示（上部）、`CluePanel`（連想ワード入力 + 自分の数字（自分のみ表示））、OrderBoard（並べ替え）
  - 右カラム (320px): オプション（小さく）、ホスト操作（確定ボタン）、簡易のルーム情報（作成者/作成時刻）
- チャットは **全幅の下部** に配置（中央カラムの下ではなく、画面最下部に伸ばす）。チャットの高さは 280–360px に設定し、スクロール可能に。

### B. レイアウト（モバイル：幅 < 900px）
- 1カラム縦積み: トピック → CluePanel → PlayersList → OrderBoard → Chat
- 各カードの `padding` を 12px、フォントサイズを縮小（body 14px → 13px）

### C. 視覚的ヒエラルキー
- トピックはカード化して強調（背景色のトーン上げ、太字、アイコン）。
- 連想ワード入力は目立つボックス（input + 更新ボタン右配置）。
- OrderBoard の確定ボタンは色で強調（Chakra: `colorScheme="blue"`、より目立たせる）。
- プレイヤーカードは左右に余白を与え、`line-height` を上げる。連想ワードは小さめのメタ情報として表示。

### D. アクセシビリティ
- コントラスト比を WCAG 準拠に。成功/失敗の色はアイコンとテキストで補完。  
- `prefers-reduced-motion` が真ならアニメーションをOFFにする。

### E. 「お題が表示されない」問題の修正ポイント
- ルーム作成ロジック（クライアント）を確認し、`topicOptions` を生成して `addDoc(collection('rooms'), {...})` に含めていない場合は追加。  
  - 例補完コード（擬似）:
    ```ts
    import topics from '@/lib/topics';
    const topicOptions = pickTwo(topics);
    await addDoc(collection(db, 'rooms'), {
      name, hostId: uid, topicOptions, topic: null, status: 'waiting', createdAt: serverTimestamp()
    });
    ```
- 既存の `room` を開いたときに `topic` が `null` なら UI で `topicOptions` を表示してホストに選ばせる UI を必ず出す。  
- 画面上の Topic 表示箇所を `room.topic ?? "お題を選択してください"` に変更し、ホストには `topicOptions` の選択 UI を表示する。

### F. Firestore 監視（onSnapshot）修正
- `useEffect`（React）で `onSnapshot(doc(db, 'rooms', roomId))` を登録して `room.topic`, `room.topicOptions`, `room.status` をリアルタイムに反映させること。  
- players の監視は `onSnapshot(collection(db, 'rooms', roomId, 'players'))` のまま。連想ワードは `player.clue` を参照して表示。

---

## 詳細指示（バックエンド / データ）
- ルーム作成時に `topicOptions` を確実に生成・保存する（`lib/topics.ts` にトピック配列を置く）。  
- topic 選択の write はホストのみ許可するルールにする（`firestore.rules` にホストチェック）：
  ```js
  allow update: if request.auth != null && request.auth.uid == resource.data.hostId;
