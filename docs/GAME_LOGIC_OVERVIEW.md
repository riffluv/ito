# ゲームロジック概要 (Game Logic Overview)

このドキュメントは本リポジトリ内 ITO 風ゲーム実装のコアロジック (状態遷移 / データモデル / アクション / 判定アルゴリズム) を、他エージェント・新規コントリビュータが最短で把握し改善提案できるように整理したものです。

---

## 1. 目的 (Purpose)

- クイックにゲームフロー全体像を把握
- 状態 / データ構造 / UI アクションの責務分離を明確化
- 不具合調査・機能追加時の “参照起点” を一本化
- 改善余地 (リファクタ / テスト / 拡張ポイント) を早期に提示

---

## 2. 全体アーキテクチャ (High-level Architecture)

```
[Firestore Rooms Collection]
   └─ room document (status, options, topic, order, deal, result, ...)
         └─ players subcollection (player documents: name, number, lastSeen, ...)

[Client]
  React (Next.js App Router) + Chakra UI v3 (Headless + Panda) + dnd-kit
  ├─ Pure Model: buildHostActionModel (UI非依存の意図生成)
  ├─ Hooks: useHostActions / useDropHandler / useRevealAnimation / ...
  ├─ UI Components: HostControlDock, CentralCardBoard, Panels, etc.
  └─ Firebase SDK listeners -> Room / Players snapshot -> derive UI state

[Game Modes]
  1. sequential (順次判定: ドロップ即判定)
  2. sort-submit (一括判定: 並べ替え提出→Evaluate)
```

---

## 3. 用語 (Glossary)

| 用語                  | 説明                                                                           |
| --------------------- | ------------------------------------------------------------------------------ |
| status                | ルームの進行状態: `waiting` → `clue` → (`reveal`) → `finished`                 |
| resolveMode           | 判定方式: `sequential` or `sort-submit`                                        |
| clue phase            | プレイヤーが連想ワードを決めカードを場に出す段階 (本実装では `playing` を統合) |
| order.list            | 確定済みの出現順 (sequential での逐次 / 一括判定後の最終結果)                  |
| order.proposal        | sort-submit モードでホストが確定前に並べ替えるための暫定配列                   |
| deal                  | 配札情報 (seed, min, max, players 配列) – number 割当順序のシードとして利用    |
| number                | プレイヤーへ配られたランダム数字 (難易度は 1..100 レンジ)                      |
| evaluate (並びを確定) | sort-submit モードで最終昇順チェックを行うホスト操作                           |
| effectiveActive       | 実際にアクティブとみなす人数 (presence > players.length フォールバック)        |
| placedCount           | 場に出た総カード数 (proposal.length>0 ? proposal.length : order.list.length)   |

---

## 4. 状態マシン (State Machine)

```
           +---------+   START_GAME    +------+
  RESET -> | waiting | --------------> | clue | ----+----> (reveal) ----> finished
           +---------+                 +------+     |  (一括判定のみ一時的)
                ^
                | (RESET)                              +----> finished (sequential 完了 / 失敗)
                +-----------------------------------------------+
```

- `reveal` は一括判定後のアニメーション用中間状態。
- 逐次判定(sequential) では `clue` → `finished` へ直接遷移。

### 主なトランジション

| イベント          | 前      | 後       | 説明                         |
| ----------------- | ------- | -------- | ---------------------------- |
| START_GAME        | waiting | clue     | ゲーム開始 (deal クリア)     |
| FINISH            | clue    | finished | 全カード確定 or 失敗判定     |
| submitSortedOrder | clue    | reveal   | 一括判定結果を reveal 演出へ |
| finalizeReveal    | reveal  | finished | アニメーション完了後確定     |
| RESET             | (任意)  | waiting  | ルーム初期化                 |

---

## 5. データモデル (Room Document Shape 概要)

```ts
interface RoomDocLike {
  status: "waiting" | "clue" | "reveal" | "finished";
  options?: {
    resolveMode?: "sequential" | "sort-submit";
    allowContinueAfterFail?: boolean;
    defaultTopicType?: string; // クイック開始用
  };
  topic?: { type: string; value: string } | null;
  order?: {
    list?: string[]; // 確定順
    proposal?: string[]; // 並び替え中 (sort-submit)
    lastNumber?: number | null;
    failed?: boolean;
    failedAt?: number | null; // 失敗が起きた index
    decidedAt?: Timestamp;
    total?: number | null; // 期待総数
  };
  deal?: {
    seed: string;
    min: number; // 1
    max: number; // 100
    players: string[]; // number 配布順シード
  } | null;
  result?: { success: boolean; revealedAt: Timestamp } | null;
}
```

### PlayerDoc (抜粋)

```ts
interface PlayerDocLike {
  name: string;
  number?: number; // dealNumbers 後に各自が算出して保存
  lastSeen?: Timestamp; // presence フォールバック
}
```

---

## 6. ホストアクションモデル (Host Action Model)

`lib/host/hostActionsModel.ts` は「現在のスナップショット → UI 表示用意図」の純関数。

- 入力: room, players, onlineCount, topicTypeLabels, hostPrimary
- 出力: `HostIntent[]` (label / disabled / reason / palette / variant)
- UI はこの配列をそのまま並べ替えてレンダリング (`HostControlDock`)

### 生成される主キー

| key          | フェーズ          | 役割                                       |
| ------------ | ----------------- | ------------------------------------------ |
| quickStart   | waiting           | 開始 (startGame → topic選択 → dealNumbers) |
| advancedMode | waiting/clue      | 詳細設定パネル表示トグル                   |
| evaluate     | clue(sort-submit) | 並び確定（一括判定）                       |
| primary      | finished          | もう一度 等 (ホスト外部渡し)               |

### evaluate 有効条件

```ts
placedCount = proposal.length > 0 ? proposal.length : order.list.length;
canEval = placedCount >= 2 && placedCount === effectiveActive;
```

- `effectiveActive` = presence 集計 (\_onlineCount) があればそれ、なければ `players.length`
- 無効理由 `reason` は段階的に変化: "カードがまだ…" / "残りX人"

---

## 7. プレイヤー操作フロー (Player Flow)

### sequential モード

1. クイック開始 (または詳細設定経由) → status=clue
2. 各自連想ワード入力 → (cluesReady 判定)
3. カードをドロップ → `commitPlayFromClue` 内で即時昇順チェック
4. 全員成功で最後のカード時 `finished(success)` / 途中失敗で `finished(failed)`

### sort-submit モード

1. クイック開始 → status=clue
2. プレイヤーは自分のカードを `addCardToProposal` で提案スロットへ (重複防止)
3. 提案配列 (`order.proposal`) はドラッグ＆ドロップ (dnd-kit) で再並び替え可能
4. 全員分が揃い evaluate ボタン活性 → `submitSortedOrder`
5. サーバー側で昇順チェック → status=reveal (演出)
6. アニメーション完了 → `finalizeReveal` → finished

---

## 8. 判定アルゴリズム (Scoring / Evaluation)

### sequential (`commitPlayFromClue` / `playCard`)

- 既存 `order.list` の最後の数字と新しい数字を比較し昇順継続か判定
- 失敗 (`myNum < lastNumber`) で `order.failed=true`, `failedAt = index`
- `shouldFinishAfterPlay` が true なら即 `finished`

### sort-submit (`submitSortedOrder`)

1. 提出 `list` を取得
2. トランザクション内で各 player.number を読み込み
3. `evaluateSorted(list, numbers)` → { success, failedAt, last }
4. 失敗なら `failedAt` 記録、成功なら success=true
5. status=reveal + order 更新 + result.success

---

## 9. ドラッグ＆ドロップ (D&D) 実装要点

- ライブラリ: dnd-kit (`DndContext`, `SortableContext`, `arrayMove`)
- sort-submit: proposal 配列を `SortableItem` リストとして表示・並べ替え
- sequential: 位置は固定スロット; プレイヤーは自分のカード1回だけドロップ
- `useDropHandler` が drop 条件 / 通知 / トランザクション呼び出し抽象化

---

## 10. 有効 / 無効状態の決定 (Enablement)

| ボタン               | 基本条件                              | 無効理由例                 |
| -------------------- | ------------------------------------- | -------------------------- |
| 開始(quickStart)     | effectiveActive >= 2                  | `2人必要: 現在1人`         |
| 並びを確定(evaluate) | placedCount == effectiveActive && >=2 | `残りX人`, `カードがまだ…` |
| 詳細                 | 常に有効 (対象フェーズ)               | -                          |

---

## 11. エッジケース / 防御的考慮 (Edge Cases)

| ケース                        | ハンドリング                                        |
| ----------------------------- | --------------------------------------------------- |
| 二重ドロップ                  | トランザクション内 `includes` チェックで早期 return |
| presence 取得失敗             | フォールバック: players.length                      |
| proposal 空 / order.list 利用 | placedCount 算出でフォールバック                    |
| アニメーション中再提出        | reveal / finished で動作抑制 (ハンドラ return)      |
| RESET 中の競合                | nextStatusForEvent 非許可でエラー / return          |
| 遅延で partial 人数           | evaluate disabled + reason で段階表示               |

---

## 12. 改善・拡張ポイント (Potential Improvements)

| 分類             | 提案                                                                           |
| ---------------- | ------------------------------------------------------------------------------ |
| 状態管理         | 明示的 XState などの statechart 導入でガード集中管理                           |
| テスト           | hostActionsModel / submitSortedOrder / sequential 判定のユニットテスト網羅強化 |
| アクセシビリティ | キーボード DnD (dnd-kit modifiers) の導入                                      |
| パフォーマンス   | Firestore リッスンを selector 化し再レンダリング削減                           |
| 監視 / デバッグ  | `window.__ROOM_SNAPSHOT` デバッグインジェクタ追加                              |
| エラーUX         | 失敗時復帰 (allowContinueAfterFail) の UI 明示導線                             |
| セキュリティ     | Firestore ルールで order.\* 書き込みをロール/本人検証付きに再厳格化            |
| 国際化           | i18n (簡体字/英語) 切替構造整備                                                |
| モバイル最適化   | DnD タップ長押しヒント & コンパクトレイアウト                                  |

---

## 13. よくある質問 (FAQ Quick Notes)

- Q: なぜ `playing` status がある? → 互換性維持 (旧フロー) のため受理のみ。新規ロジックは `clue` に統合。
- Q: evaluate が出ない / 押せない → `topic` 未選択 or `placedCount != effectiveActive`。Board のカウンタと突合せ。
- Q: 並び提出順と確定順差異? → sort-submit では proposal 並べ替え結果がそのままチェック対象。

---

## 14. 変更ガイド (How to Change Safely)

1. 状態追加 → nextStatusForEvent / hostActionsModel / UI フェーズ条件を同時更新
2. 新規ボタン → hostActionsModel に intent 追加 → useHostActions で onClick 実装
3. 判定条件変更 → sequential: applyPlay / shouldFinishAfterPlay, sort-submit: evaluateSorted を更新
4. 人数条件拡張 → effectiveActive 算出ロジック (presence 取得箇所) を共通 util 化

---

## 15. 依存ライブラリメモ (2025)

| ライブラリ         | 用途                       | 要点                                                |
| ------------------ | -------------------------- | --------------------------------------------------- |
| Chakra UI v3       | UI コンポーネント/トークン | Headless + Panda, recipes, motion 依存削減          |
| dnd-kit            | DnD 並べ替え               | 軽量/アクセシブル、`SortableContext` + `arrayMove`  |
| Firebase Firestore | 永続 & 同期                | ルーム/プレイヤー状態, トランザクションで整合性確保 |

---

## 16. ダイアグラム (簡易シーケンス: sort-submit)

```
Host: QuickStart -> startGame -> topic select -> dealNumbers
Players: addCardToProposal (並行)
Host UI: evaluate (enabled when placedCount == effectiveActive >=2)
Host: submitSortedOrder(list)
Server(tx): evaluateSorted -> status=reveal -> result
Client: finalizeReveal() after animation -> finished
```

---

## 17. ショートチェックリスト (Debug Cheat Sheet)

- status: clue ? yes/no
- resolveMode: sort-submit ?
- topic: set?
- proposal.length vs effectiveActive
- order.list (sequential fallback)
- evaluate disabled reason (HostIntent.reason)
- Firestore rules: 書き込み失敗ログ

---

## 18. 最小変更での新機能追加例

例: "途中で人数増減を許容した再計算" を追加する場合:

1. presence 更新監視で effectiveActive 変化を受け取り
2. hostActionsModel 内 evaluate 条件を `placedCount >= Math.min(2, effectiveActive) && placedCount === effectiveActive` などに改変
3. 既存テスト更新 / 新規テスト (増員→evaluate再無効→再有効) 追加

---

## 19. 終わりに

このドキュメントはエントリポイント。変更のたびに差分を追記し "何が仕様なのか" を常に明文化することでスパゲティ化を防ぎます。改善 PR では該当節の更新を忘れずに。

> Maintainers: 仕様変更の初手は README ではなく本ファイル更新から。
