# Online-ITO Game Spec (Next.js + Chakra UI + Firebase)

## 技術スタック
- Next.js 14 (App Router)
- Chakra UI（テーマカスタム・レスポンシブ対応）
- Firebase  
  - Firestore（リアルタイム同期）
  - Authentication（匿名ログイン）
- framer-motion（アニメーション）
- dnd-kit（カード並べ替え用）

---

## 概要
「ito」風オンライン協力ゲーム。  
プレイヤーが自分のカードの数字を直接見せず、ヒントを出し合い協力して昇順に並べる。  

MVP は **シンプルルール版** を完全実装。

---

## ゲームの流れ
1. **ロビー / 部屋作成**
   - 匿名ログイン
   - 部屋一覧表示（公開ルーム）
   - 「部屋を作る」ボタン → 作成者がホスト
   - 部屋名を入力（必須）

2. **ルームUI**
   - 参加者一覧（アバター・名前）
   - チャット（常設）
   - ホストのみ「ゲーム開始」ボタン
   - オプション設定  
     - 追加ヒントON/OFF  
     - パス上限（例: 2回まで）  
     - 失敗後の継続確認ON/OFF  

3. **ゲーム開始**
   - プレイヤーごとにランダムで数字カードを配布（例: 1〜100）
   - プレイヤーは「ヒント1」を必ず入力
   - （オプションON時のみ）全員のヒント1提出後に「ヒント2」解禁
   - 同時に「フリーチャット」欄あり

4. **並べ替えフェーズ**
   - 全員のヒントが出揃ったら、  
     **ドラッグ&ドロップで並べ替え**可能
   - 並べ替え確定 → 全員で確認ボタンを押す

5. **答え合わせ**
   - 全員の数字カードを昇順にリビール
   - 並びが完全一致 → **クリア**
   - 失敗 →  
     オプションで「最後まで続けますか？」ダイアログ表示  

6. **終了画面**
   - 成功/失敗メッセージ
   - プレイログ（順番 & ヒント一覧）
   - 「もう一度」ボタン / 「ロビーへ」

---

## Firestore 構造

```jsonc
rooms (collection)
  └─ {roomId} (doc)
      ├─ name: string
      ├─ hostId: string
      ├─ options: {
      │    allowSecondClue: boolean,
      │    passLimit: number,
      │    allowContinueAfterFail: boolean
      │  }
      ├─ status: "waiting" | "playing" | "finished"
      ├─ createdAt: timestamp
      ├─ players (subcollection)
      │    └─ {playerId} (doc)
      │         ├─ name: string
      │         ├─ avatar: string
      │         ├─ number: int
      │         ├─ clue1: string
      │         ├─ clue2: string
      │         ├─ ready: boolean
      │         └─ orderIndex: int
      └─ chat (subcollection)
           └─ {messageId} (doc)
                ├─ sender: string
                ├─ text: string
                └─ createdAt: timestamp


[ ロビー画面 ]
 ┌───────────────────────────┐
 │ Online-ITO                │
 │ [部屋一覧]                │
 │  - 部屋A (3/6) [参加]      │
 │  - 部屋B (2/6) [参加]      │
 │ [部屋を作る]               │
 └───────────────────────────┘

[ ルーム画面 ]
 ┌───────────────┬───────────────┐
 │ 参加者一覧       │ チャット欄       │
 │ (アバター+名前) │ [メッセージ入力] │
 │                 │                   │
 └───────────────┴───────────────┘
 [ホスト: ゲーム開始]

[ ゲーム画面 ]
 ┌───────────────┐
 │ 自分のカード(非公開) │
 │ ヒント入力欄          │
 │ フリーチャット        │
 └───────────────┘
   ↓
 並べ替えUI (カードをドラッグで順番調整)

[ 結果画面 ]
 ┌───────────────┐
 │ 正解 / 失敗      │
 │ [数字の公開順]    │
 │ [もう一度] [ロビーへ] │
 └───────────────┘


You are Codex CLI (GPT-5, high mode).
Implement the above "Online-ITO Game Spec" as a working Next.js 14 + Chakra UI project.
Use Firebase (Firestore + Authentication) as backend.

Constraints:
- Complete implementation, from lobby to game end.
- Keep UI simple but table-game like.
- Implement all flows described (join room, start game, give clues, reorder, reveal, result).
- Use Chakra UI components with a custom theme (soft rounded cards, shadow, brand color).
- Include Firestore schema as described.
- Use framer-motion for animations.
- Use dnd-kit for drag-and-drop ordering.
- Implement anonymous login via Firebase Authentication.
- Ensure consistency: no dead-ends, user can always proceed (retry or back to lobby).
