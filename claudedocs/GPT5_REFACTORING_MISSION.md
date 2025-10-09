# 🚀 GPT-5 Codex: 完全リファクタリング・ミッション

## 📋 **ミッション概要**

このドキュメントは、**Online ITO (ドラクエ風数字カードゲーム)** のパフォーマンス最適化と超リファクタリングを実行するための、GPT-5 Codex向けの完全指示書です。

---

## 🎯 **ミッションの目的**

### **最優先課題**
1. **ゲーム開始ボタン押下後の遅延を解消** - 開始ボタンから実際のゲーム開始までの体感速度を向上
2. **進行不可能バグの根絶** - ゲームが進行できなくなる状況を完全に排除
3. **全体的なパフォーマンス向上** - Firestore読み書き、React re-render、不要な計算を最適化

### **重要な制約**
- ✅ **ゲームロジックは壊さない** - 現在正常に動作している機能を保持
- ✅ **デザインシステムは維持** - ドラクエ風UI統一を保つ
- ✅ **最適化は積極的に実施** - パフォーマンス向上のためのロジック改善はOK
- ✅ **綺麗なコードに書き換える** - 可読性・保守性を大幅に向上

---

## 🧠 **【重要】あなたの役割と思考プロセス**

### **あなたは指示に盲従するBotではありません**

このドキュメントは「ガイドライン」であり「絶対的な命令」ではありません。
**あなた（GPT-5 Codex）は複雑なプログラミングのエキスパート**です。

### **期待される姿勢**

1. **🔍 批判的思考を持つ**
   - この指示書の提案が本当に最適か、常に疑問を持つ
   - 「もっと良い方法があるのでは？」と自問する
   - より効率的・安全な実装パターンがあれば積極的に提案する

2. **⚠️ 問題を発見したら立ち止まる**
   - 指示通りに実装すると問題が起きそうな場合は**即座に警告**
   - 「この変更はXXXの理由で危険です」と明確に伝える
   - 代替案を提示し、ユーザーに判断を仰ぐ

3. **💡 改善提案を積極的に行う**
   - 指示書にない、より良いアプローチを発見したら提案
   - 「Phase 1の代わりに、XXXの方が効率的です」と主張してOK
   - トレードオフを明示した上で選択肢を提示

4. **🛡️ 安全性を最優先**
   - パフォーマンス < 安全性・正確性
   - 不確実な変更は実装前に確認を求める
   - テストできない変更は避ける

### **具体的な思考プロセス（必須）**

各タスク実行前に、以下を**必ず**自問してください:

```
✅ チェックリスト（タスク実行前）

1. 【理解確認】
   □ このタスクの目的を理解しているか？
   □ 変更対象のコードの現在の動作を理解しているか？
   □ 依存関係・影響範囲を把握しているか？

2. 【リスク評価】
   □ この変更でゲームロジックが壊れる可能性は？
   □ 既存の動作に影響を与える可能性は？
   □ データ損失・競合状態のリスクは？
   □ エッジケースは考慮されているか？

3. 【代替案検討】
   □ 指示書の提案より良い方法はないか？
   □ よりシンプルな実装はないか？
   □ 既存のパターン・ライブラリで解決できないか？

4. 【検証計画】
   □ この変更をどうテストするか？
   □ 問題が起きた場合、どう検出するか？
   □ ロールバックは容易か？

5. 【判断】
   □ 自信を持って実装できるか？
   □ 不明点・懸念点はないか？
   □ ユーザーに確認すべきことはないか？
```

### **問題発見時の対応フロー**

```typescript
// 疑似コード: あなたの思考プロセス

function shouldProceedWithTask(task: Task): Decision {
  const risks = analyzeRisks(task);
  const alternatives = findBetterAlternatives(task);

  if (risks.includes("DATA_LOSS") || risks.includes("LOGIC_BREAK")) {
    return {
      action: "STOP",
      message: "🚨 危険: このタスクは[具体的なリスク]を引き起こす可能性があります",
      alternatives: alternatives,
      requestUserInput: true
    };
  }

  if (alternatives.length > 0 && alternatives[0].betterThan(task)) {
    return {
      action: "PROPOSE_ALTERNATIVE",
      message: "💡 提案: より良い方法があります",
      comparison: compareApproaches(task, alternatives[0]),
      requestUserInput: true
    };
  }

  if (uncertaintyLevel > THRESHOLD) {
    return {
      action: "REQUEST_CLARIFICATION",
      message: "❓ 確認: [不明点]について確認させてください",
      questions: listUncertainties(),
      requestUserInput: true
    };
  }

  return {
    action: "PROCEED",
    message: "✅ 安全性を確認しました。実装を開始します",
    confidence: calculateConfidence()
  };
}
```

### **コミュニケーション規約**

#### **実装前に報告すべきこと**

1. **🚨 重大な懸念がある場合**
```
🚨 警告: Phase 1のトランザクション統合について

【懸念点】
- runTransactionはFirestoreの制約上、5回までしか再試行されない
- ネットワーク不安定時にゲーム開始が完全に失敗するリスク

【提案】
代わりに、楽観的ロック（timestamp比較）+ バッチ書き込みを使用することで、
より堅牢な実装が可能です。

【判断をお願いします】
A. 指示通りrunTransactionで実装（高速だが失敗リスクあり）
B. 楽観的ロック方式に変更（やや遅いが堅牢）
```

2. **💡 より良い方法を発見した場合**
```
💡 改善提案: useHostActionsの最適化について

【指示書の提案】
依存配列を細分化して再計算を削減

【より良い方法】
useSyncExternalStoreを使ってFirestoreの変更を直接購読し、
useMemo自体を不要にする設計

【メリット】
- 再レンダリング完全削減（100%）
- コードが30%短縮
- React 18の並行レンダリングに対応

【デメリット】
- 実装が複雑（ただし長期的には保守しやすい）

【推奨】
後者を採用すべきと考えますが、いかがでしょうか？
```

3. **❓ 不明点がある場合**
```
❓ 確認が必要です: playerStateUtilsの設計

【不明点】
lib/game/playerStateUtils.tsを新規作成する指示がありますが、
既存のlib/firebase/players.tsと役割が重複しているように見えます。

【質問】
1. players.tsをリファクタリングして統合すべきでしょうか？
2. それとも別ファイルとして共存させるべきでしょうか？

【推奨】
players.tsに統合する方が一貫性が保たれると考えますが、
指示書の意図を確認したいです。
```

### **自信度の明示**

各実装の最後に、自信度を必ず明記してください:

```
✅ Phase 1 タスク1.1 完了

【実装内容】
lib/game/quickStart.tsを作成しました。

【自信度】
🟢 高（95%） - 十分にテストし、動作を確認済み

【テスト結果】
- ゲーム開始: 成功（450ms）
- エラーハンドリング: 確認済み
- トランザクション競合: 対応済み

【既知の制限】
- ネットワークタイムアウト時は3秒後に再試行（Firestore仕様）

【推奨事項】
本番デプロイ前に、負荷テストを実施してください。
```

---

## 🎯 **成功のための原則**

1. **指示書は地図、あなたはパイロット**
   - 地図は参考にするが、最終判断はあなたが行う
   - 危険な地形を発見したら、別ルートを提案する

2. **完璧主義より安全性**
   - 不確実なら実装しない
   - 段階的に進め、各ステップで検証

3. **ユーザーはパートナー**
   - 専門知識を活かして、より良い方向に導く
   - 盲従ではなく、対話を通じて最適解を見つける

4. **失敗を恐れない、検証を怠らない**
   - 実装後は必ずテスト
   - 問題を発見したら即座に報告・修正

---

**あなたの専門性を信頼しています。批判的に考え、積極的に提案してください！**

---

## 🔥 **特定されたパフォーマンス問題**

### **1. ゲーム開始フロー（START_GAME）の遅延**

#### **問題箇所**
- `components/hooks/useHostActions.ts:92-129` - `handleQuickStart`関数
- `lib/game/room.ts:41-77` - `startGame`関数
- `lib/game/topicControls.ts:35-68` - `selectCategory`関数
- `lib/game/room.ts:80-130` - `dealNumbers`関数

#### **遅延の原因**
```typescript
// ❌ 問題: 4つの処理が直列実行されている
async function handleQuickStart() {
  // 1. startGame() - Firestore書き込み + 全プレイヤー状態バッチ更新
  await startGameAction(roomId);

  // 2. selectCategory() - Firestoreからお題取得 + 書き込み
  await topicControls.selectCategory(roomId, selectType);

  // 3. dealNumbers() - 全プレイヤー取得 + presence確認 + 配布計算 + 書き込み
  await topicControls.dealNumbers(roomId);

  // 4. broadcastNotify() - 各処理で個別に通知送信
}
```

#### **具体的な問題**
1. **直列実行による累積遅延**: 各処理が前の処理を待つため、遅延が蓄積
2. **重複するFirestore読み取り**:
   - `startGame()`: `getDoc(rooms/{roomId})` + `getDocs(rooms/{roomId}/players)`
   - `dealNumbers()`: `getDocs(rooms/{roomId}/players)` + presence確認
   - **同じplayersコレクションを2回読み取り** = 2倍のコスト
3. **3回のFirestore書き込み**:
   - `startGame()`: room更新 + playersバッチ更新
   - `selectCategory()`: room更新（topic関連）
   - `dealNumbers()`: room更新（deal/order）
4. **3回の個別通知送信**: 各処理で`broadcastNotify()`を呼び出し

#### **期待される改善**
```typescript
// ✅ 改善案: トランザクション化 + 並列処理
async function handleQuickStart() {
  // 1回のFirestoreトランザクションで全て実行
  await runTransaction(db, async (transaction) => {
    // 1. players読み取り（1回のみ）
    const playersSnap = await getDocs(...);

    // 2. 並列処理: お題選択 + 配布計算
    const [topic, dealData] = await Promise.all([
      fetchAndPickTopic(selectType),
      calculateDealData(playersSnap, presenceData)
    ]);

    // 3. 一括書き込み
    transaction.update(roomRef, {
      status: "clue",
      topic,
      deal: dealData,
      // ... 他の必要なフィールド
    });

    // 4. playersバッチ更新（1回で完結）
    playersSnap.forEach(doc => {
      transaction.update(doc.ref, { number: null, clue1: "", ready: false });
    });
  });

  // 5. 通知は最後に1回だけ
  await broadcastNotify(roomId, "success", "ゲーム開始", "連想ワードを入力してください");
}
```

**期待効果**:
- Firestore読み取り: **6回 → 2回** (67%削減)
- Firestore書き込み: **3回 → 1回** (67%削減)
- 通知送信: **3回 → 1回** (67%削減)
- **体感速度: 300-500ms削減見込み**

---

### **2. Firebase Firestore 過剰アクセス問題**

#### **問題パターン**

**Pattern A: 重複読み取り**
```typescript
// ❌ lib/game/room.ts
export async function startGame(roomId: string) {
  const snap = await getDoc(ref); // 1回目の読み取り
  const ps = await getDocs(playersRef); // players読み取り
  // ...
}

export async function dealNumbers(roomId: string) {
  const snap = await getDocs(playersRef); // 同じplayersを再読み取り！
  // ...
}
```

**Pattern B: トランザクション未使用**
```typescript
// ❌ lib/game/topicControls.ts:99-174
async resetTopic(roomId: string) {
  const snap = await getDoc(roomRef); // 読み取り
  // ...
  batch.update(roomRef, { ... }); // 書き込み
  const playersSnapshot = await getDocs(playersRef); // 読み取り
  playersSnapshot.forEach(doc => batch.update(doc.ref, { ... })); // 書き込み
  await batch.commit(); // バッチ実行
}
```

**Pattern C: onSnapshot差分検知の不完全性**
```typescript
// ⚠️ lib/hooks/useRoomState.ts:102-111
// 部分的に実装されているが、全てのonSnapshotで統一されていない
const dataHash = JSON.stringify(rawData);
if (dataHash === prevDataHash) return; // スキップ
```

#### **検出された問題箇所**
- `lib/game/room.ts`: 15箇所のFirestore呼び出し
- `lib/game/topicControls.ts`: 8箇所のFirestore呼び出し
- `lib/hooks/useRoomState.ts`: onSnapshot内の差分検知
- `lib/hooks/useParticipants.ts`: players購読の最適化不足
- `lib/services/roomService.ts`: 16箇所のFirestore呼び出し

---

### **3. React Re-render 問題**

#### **問題箇所**

**A. useEffect依存配列の過剰更新**
```typescript
// ❌ components/hooks/useHostActions.ts:52-61
const intents = useMemo(
  () => buildHostActionModel(room, players, onlineCount, ...),
  [room, players, onlineCount, hostPrimaryAction] // roomオブジェクト全体が依存
);
// room.statusが変わらなくてもroom参照が変わると再計算される
```

**B. 不要なコンポーネント再マウント**
```typescript
// ❌ app/rooms/[roomId]/page.tsx:71-82
const MinimalChat = dynamic(() => import("..."), { ssr: false }); // 毎回インポート
const MvpLedger = dynamic(() => import("..."), { ssr: false });
const RoomPasswordPrompt = dynamic(() => import("..."), { ssr: false });
```

**C. 大きなコンポーネントの分割不足**
```typescript
// ⚠️ app/rooms/[roomId]/page.tsx: 800行超の単一コンポーネント
function RoomPageContent({ roomId }: RoomPageContentProps) {
  // 20+ useState
  // 30+ useEffect
  // 15+ useCallback
  // 大量のロジックが1つのコンポーネントに集中
}
```

#### **検出された具体的な問題**
1. **useHostActions**: `room`オブジェクト全体への依存により、status以外の変更でも再計算
2. **useRoomState**: onSnapshot更新のたびに全コンポーネントが再レンダリング
3. **RoomPageContent**: 状態管理が肥大化し、子コンポーネントへの不要なprops伝播

---

### **4. コード品質問題**

#### **A. 重複コード**

**重複パターン1: プレイヤー状態クリア処理**
```typescript
// ❌ 同じコードが4箇所に存在
// lib/game/room.ts:61-69 (startGame)
// lib/game/room.ts:167-179 (continueAfterFail)
// lib/game/room.ts:190-198 (resetRoom)
// lib/game/topicControls.ts:130-139 (resetTopic)

const playersRef = collection(db!, "rooms", roomId, "players");
const ps = await getDocs(playersRef);
const batch = writeBatch(db!);
ps.forEach((d) => {
  batch.update(d.ref, { number: null, clue1: "", ready: false, orderIndex: 0 });
});
await batch.commit();
```

**重複パターン2: broadcastNotify実装**
```typescript
// ❌ 同じ関数が2ファイルに重複定義
// lib/game/room.ts:28-39
// lib/game/topicControls.ts:19-30

async function broadcastNotify(
  roomId: string,
  type: "info" | "warning" | "success" | "error",
  title: string,
  description?: string
) { /* ... */ }
```

**重複パターン3: エラーハンドリング**
```typescript
// ❌ 同じパターンが10箇所以上
try {
  // ...
} catch (error: any) {
  if (isFirebaseQuotaExceeded(error)) {
    handleFirebaseQuotaError("操作名");
    notify({ title: "🚨 Firebase読み取り制限", ... });
  } else {
    notify({ title: "操作失敗", description: error?.message, type: "error" });
  }
}
```

#### **B. 未使用コード**

**検出された未使用ファイル・コード**
1. `app/rooms/[roomId]/page.tsx.bak` - バックアップファイル（削除推奨）
2. `lib/game/room.ts:132` - `finalizeOrder`関数（コメント: "現行フローでは未使用"）
3. デバッグコード:
   - `lib/firebase/writeQueue.ts:4-7` - `ENABLE_QUEUE_DEBUG`フラグ
   - `lib/hooks/useLobbyCounts.ts:232-689` - 大量のDEBUGフラグ
   - `lib/hooks/useOptimizedRooms.ts:114-334` - `DEBUG_FETCH`フラグ

#### **C. console.log/warn/error の残存**

**検出箇所**（本番環境で削除すべき）
- `lib/audio/SoundManager.ts`: 9箇所
- `lib/server/firebaseAdmin.ts`: 3箇所
- `lib/utils/log.ts`: 専用ログ関数（保持OK）
- その他: 15箇所

---

## 📝 **リファクタリング指示**

### **Phase 1: ゲーム開始フロー最適化（最優先）**

#### **タスク 1.1: startGame処理の統合**

**目的**: `handleQuickStart`の4つの処理を1つのトランザクションに統合

**実装指示**:

1. **新規ファイル作成**: `lib/game/quickStart.ts`
```typescript
/**
 * クイックスタート処理を統合した最適化版
 * 従来の4つの処理を1トランザクションで実行
 */
import { db } from "@/lib/firebase/client";
import { fetchPresenceUids, presenceSupported } from "@/lib/firebase/presence";
import { fetchTopicSections, getTopicsByType, pickOne, type TopicType } from "@/lib/topics";
import { isActive, ACTIVE_WINDOW_MS } from "@/lib/time";
import { collection, doc, getDocs, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";

type QuickStartOptions = {
  defaultTopicType: string;
  onlineCount?: number;
  playersLength: number;
};

type QuickStartResult = {
  success: boolean;
  assignedCount: number;
  topic: string | null;
};

export async function executeQuickStart(
  roomId: string,
  options: QuickStartOptions
): Promise<QuickStartResult> {
  const { defaultTopicType, onlineCount, playersLength } = options;

  return await runTransaction(db!, async (transaction) => {
    // 1. 並列データ取得（トランザクション外で可能なもの）
    const roomRef = doc(db!, "rooms", roomId);
    const playersRef = collection(db!, "rooms", roomId, "players");

    // 並列実行で時間短縮
    const [roomSnap, playersSnap, topicSections, presenceUids] = await Promise.all([
      getDoc(roomRef),
      getDocs(playersRef),
      fetchTopicSections(),
      presenceSupported() ? fetchPresenceUids(roomId) : Promise.resolve([])
    ]);

    // 2. お題選択（同期処理）
    const selectType = defaultTopicType === "カスタム" ? "通常版" : defaultTopicType;
    const pool = getTopicsByType(topicSections, selectType as TopicType);
    const topic = pickOne(pool) || null;

    // 3. 配布計算（同期処理）
    const all: { id: string; uid?: string; lastSeen?: any }[] = [];
    playersSnap.forEach((d) => all.push({ id: d.id, ...(d.data() as any) }));

    const now = Date.now();
    const activeByRecency = all.filter((p) =>
      isActive((p as any)?.lastSeen, now, ACTIVE_WINDOW_MS)
    );

    const fallbackPool = activeByRecency.length > 0 ? activeByRecency : all;
    let target = fallbackPool;

    // presence優先処理
    if (Array.isArray(presenceUids) && presenceUids.length > 0) {
      const presenceSet = new Set(presenceUids);
      const presencePlayers: typeof all = [];
      const missingPlayers: typeof all = [];

      for (const player of fallbackPool) {
        if (presenceSet.has(player.id)) {
          presencePlayers.push(player);
        } else {
          missingPlayers.push(player);
        }
      }

      if (presencePlayers.length > 0) {
        target = [...presencePlayers, ...missingPlayers];
      }
    }

    if (!target.length) target = fallbackPool;
    if (target.length < Math.min(2, all.length)) target = all;

    const ordered = [...target].sort((a, b) =>
      String(a.uid || a.id).localeCompare(String(b.uid || b.id))
    );

    const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const dealData = {
      seed,
      min: 1,
      max: 100,
      players: ordered.map((p) => p.id)
    };

    // 4. トランザクション内で一括更新
    transaction.update(roomRef, {
      status: "clue",
      result: null,
      deal: dealData,
      order: null,
      mvpVotes: {},
      topic,
      topicBox: selectType,
      topicOptions: null,
      "order.total": ordered.length,
      lastActiveAt: serverTimestamp(),
    });

    // 5. playersバッチ更新
    playersSnap.forEach((playerDoc) => {
      transaction.update(playerDoc.ref, {
        number: null,
        clue1: "",
        ready: false,
        orderIndex: 0
      });
    });

    return {
      success: true,
      assignedCount: ordered.length,
      topic
    };
  });
}
```

2. **useHostActions修正**: `components/hooks/useHostActions.ts:92-129`
```typescript
import { executeQuickStart } from "@/lib/game/quickStart";

// handleQuickStart関数を置き換え
const handleQuickStart = useCallback(async () => {
  try {
    if (autoStartControl?.locked) return;

    const activeCount = typeof onlineCount === "number" ? onlineCount : players.length;
    if (activeCount < 2) {
      notify({
        id: toastIds.numberDealWarningPlayers(roomId),
        title: "プレイヤーは2人以上必要です",
        type: "warning",
        duration: 2200,
      });
      return;
    }

    const defaultType = room.options?.defaultTopicType || "通常版";
    autoStartControl?.begin?.(4500, { broadcast: true });

    muteNotifications(
      [
        toastIds.topicChangeSuccess(roomId),
        toastIds.topicShuffleSuccess(roomId),
        toastIds.numberDealSuccess(roomId),
        toastIds.gameReset(roomId),
      ],
      2800
    );

    // ★ 統合処理を1回呼び出すだけ
    const result = await executeQuickStart(roomId, {
      defaultTopicType: defaultType,
      onlineCount,
      playersLength: players.length
    });

    // 通知は最後に1回だけ（broadcastNotifyをインポート）
    await broadcastNotify(
      roomId,
      "success",
      "ゲーム開始しました",
      `お題: ${result.topic || "なし"} | 参加: ${result.assignedCount}人`
    );

  } catch (error) {
    autoStartControl?.clear?.();
    handleGameError(error, "クイック開始");
  }
}, [autoStartControl, onlineCount, players.length, room.options?.defaultTopicType, roomId]);
```

**期待効果**:
- Firestore読み取り: **67%削減**
- Firestore書き込み: **67%削減**
- 処理時間: **300-500ms短縮**

---

#### **タスク 1.2: 重複するプレイヤー状態クリア処理の共通化**

**実装指示**:

1. **新規ファイル作成**: `lib/game/playerStateUtils.ts`
```typescript
/**
 * プレイヤー状態管理のユーティリティ関数
 */
import { db } from "@/lib/firebase/client";
import { collection, getDocs, writeBatch } from "firebase/firestore";

export type ClearPlayerStateOptions = {
  clearNumber?: boolean;
  clearClue?: boolean;
  clearReady?: boolean;
  clearOrderIndex?: boolean;
};

/**
 * 全プレイヤーの状態をクリアする
 * @param roomId ルームID
 * @param options クリアするフィールドのオプション
 * @returns クリアしたプレイヤー数
 */
export async function clearAllPlayerStates(
  roomId: string,
  options?: ClearPlayerStateOptions
): Promise<number> {
  const {
    clearNumber = true,
    clearClue = true,
    clearReady = true,
    clearOrderIndex = true
  } = options || {};

  const playersRef = collection(db!, "rooms", roomId, "players");
  const ps = await getDocs(playersRef);
  const batch = writeBatch(db!);

  const updates: any = {};
  if (clearNumber) updates.number = null;
  if (clearClue) updates.clue1 = "";
  if (clearReady) updates.ready = false;
  if (clearOrderIndex) updates.orderIndex = 0;

  let count = 0;
  ps.forEach((d) => {
    batch.update(d.ref, updates);
    count++;
  });

  await batch.commit();
  return count;
}
```

2. **既存ファイル修正**: 4箇所の重複コードを置換

**`lib/game/room.ts` の修正**:
```typescript
import { clearAllPlayerStates } from "@/lib/game/playerStateUtils";

// startGame関数内（61-69行目）
export async function startGame(roomId: string) {
  const ref = doc(db!, "rooms", roomId);
  const snap = await getDoc(ref);
  const curr: any = snap.data();
  const currentStatus = curr?.status || "waiting";

  if (currentStatus !== "waiting") {
    throw new Error("開始できるのは待機中のみです");
  }

  await updateDoc(ref, {
    status: "clue",
    result: null,
    deal: null,
    order: null,
    mvpVotes: {},
    lastActiveAt: serverTimestamp(),
  });

  // ❌ 削除（61-69行目）
  // try {
  //   const { collection, getDocs, writeBatch } = await import("firebase/firestore");
  //   const playersRef = collection(db!, "rooms", roomId, "players");
  //   const ps = await getDocs(playersRef);
  //   const batch = writeBatch(db!);
  //   ps.forEach((d) => {
  //     batch.update(d.ref, { number: null, clue1: "", ready: false, orderIndex: 0 });
  //   });
  //   await batch.commit();
  // } catch {}

  // ✅ 追加
  try {
    await clearAllPlayerStates(roomId);
  } catch (error) {
    // プレイヤー状態クリア失敗は無視（ゲーム開始自体は成功）
  }

  // ゲーム開始通知をブロードキャスト
  try {
    await broadcastNotify(roomId, "success", "ゲームを開始しました", "連想ワードを入力してください");
  } catch {
    // 通知失敗は無視
  }
}

// continueAfterFail関数内（167-179行目）
export async function continueAfterFail(roomId: string) {
  const ref = doc(db!, "rooms", roomId);
  const snap = await getDoc(ref);
  const curr: any = snap.data();

  if (curr?.status !== "reveal" && curr?.status !== "finished") {
    throw new Error("進行中は継続できません");
  }

  await updateDoc(ref, {
    status: "waiting",
    result: null,
    order: null,
    deal: null,
    mvpVotes: {},
    lastActiveAt: serverTimestamp(),
  });

  // ✅ 置き換え
  try {
    await clearAllPlayerStates(roomId);
  } catch (e) {
    logError("continueAfterFail", "player-state-clear-failed", e);
  }
}

// resetRoom関数内（190-198行目）
export async function resetRoom(roomId: string) {
  const ref = doc(db!, "rooms", roomId);
  const snap = await getDoc(ref);
  const curr: any = snap.data();
  const next = nextStatusForEvent(curr?.status || "waiting", { type: "RESET" });

  if (!next) throw new Error("invalid transition: RESET");

  await updateDoc(ref, {
    status: next,
    result: null,
    deal: null,
    order: null,
    mvpVotes: {},
    lastActiveAt: serverTimestamp()
  });

  // ✅ 置き換え
  try {
    await clearAllPlayerStates(roomId);
  } catch (error) {
    // リセット失敗は無視
  }
}
```

**`lib/game/topicControls.ts` の修正**:
```typescript
import { clearAllPlayerStates } from "@/lib/game/playerStateUtils";

export const topicControls = {
  async resetTopic(roomId: string) {
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const roomRef = doc(db!, "rooms", roomId);
      const snap = await getDoc(roomRef);

      if (snap.exists()) {
        const status = (snap.data() as any)?.status;
        if (status === "clue" || status === "reveal") {
          throw new Error("進行中はリセットできません");
        }
      }

      const { writeBatch } = await import("firebase/firestore");
      const batch = writeBatch(db!);

      batch.update(roomRef, {
        status: "waiting",
        result: null,
        deal: null,
        order: null,
        round: 0,
        topic: null,
        topicOptions: null,
        topicBox: null,
        closedAt: null,
        expiresAt: null,
      });

      await batch.commit();

      // ✅ 置き換え（130-139行目を削除）
      try {
        await clearAllPlayerStates(roomId, {
          clearClue: true,
          clearReady: true
        });
      } catch (error) {
        logWarn("topicControls", "reset-topic-clear-players-failed", error);
      }

      let verified = true;
      try {
        verified = await verifyPlayerStatesCleared(roomId);
      } catch (verifyError) {
        logWarn("topicControls", "reset-topic-verify-failed", verifyError);
        verified = false;
      }

      if (!verified) {
        await emergencyResetPlayerStates(roomId);
        throw new Error("プレイヤー状態を安全に再初期化しました。もう一度お試しください。");
      }

      await broadcastNotify(roomId, "success", "ゲームをリセットしました");
    } catch (error: any) {
      if (isFirebaseQuotaExceeded(error)) {
        handleFirebaseQuotaError("ゲームリセット");
        notify({
          title: "🚨 Firebase読み取り制限",
          description: "現在ゲームをリセットできません。24時間後に再度お試しください。",
          type: "error",
        });
      } else {
        notify({
          title: "ゲームリセットに失敗",
          description: error?.message || String(error),
          type: "error"
        });
      }
    }
  },
};
```

---

### **Phase 2: Firestore最適化**

#### **タスク 2.1: broadcastNotify共通化**

**実装指示**:

1. **新規ファイル作成**: `lib/firebase/notify.ts`
```typescript
/**
 * 通知ブロードキャスト共通関数
 */
import { sendNotifyEvent } from "@/lib/firebase/events";

export async function broadcastNotify(
  roomId: string,
  type: "info" | "warning" | "success" | "error",
  title: string,
  description?: string
): Promise<void> {
  try {
    await sendNotifyEvent(roomId, { type, title, description });
  } catch {
    // ignore broadcast failure - silent fail
    // 通知送信失敗はゲーム進行に影響しないため無視
  }
}
```

2. **既存ファイル修正**:

**`lib/game/room.ts` の修正**:
```typescript
// ❌ 削除（28-39行目）
// async function broadcastNotify(
//   roomId: string,
//   type: "info" | "warning" | "success" | "error",
//   title: string,
//   description?: string
// ) {
//   try {
//     await sendNotifyEvent(roomId, { type, title, description });
//   } catch {
//     // ignore broadcast failure
//   }
// }

// ✅ 追加（ファイル上部のimport文）
import { broadcastNotify } from "@/lib/firebase/notify";
```

**`lib/game/topicControls.ts` の修正**:
```typescript
// ❌ 削除（19-30行目）
// async function broadcastNotify(
//   roomId: string,
//   type: "info" | "warning" | "success" | "error",
//   title: string,
//   description?: string
// ) {
//   try {
//     await sendNotifyEvent(roomId, { type, title, description });
//   } catch {
//     // ignore broadcast failure
//   }
// }

// ✅ 追加（ファイル上部のimport文）
import { broadcastNotify } from "@/lib/firebase/notify";
```

**`lib/game/quickStart.ts` にも追加**:
```typescript
import { broadcastNotify } from "@/lib/firebase/notify";
```

---

#### **タスク 2.2: エラーハンドリング統一**

**実装指示**:

1. **既存ファイル拡張**: `lib/utils/errorHandling.ts`に追加
```typescript
import { notify } from "@/components/ui/notify";

/**
 * Firebase操作の統一エラーハンドラー
 * try-catchブロックを簡潔に記述できるユーティリティ
 *
 * @example
 * const result = await handleFirebaseOperation(
 *   () => updateDoc(doc(db!, "rooms", roomId), { topic: value }),
 *   "お題設定",
 *   { successMessage: "お題を更新しました" }
 * );
 */
export async function handleFirebaseOperation<T>(
  operation: () => Promise<T>,
  context: string,
  options?: {
    successMessage?: string;
    successDescription?: string;
    quotaMessage?: string;
    suppressErrorNotify?: boolean;
  }
): Promise<T | null> {
  try {
    const result = await operation();

    if (options?.successMessage) {
      notify({
        title: options.successMessage,
        description: options.successDescription,
        type: "success",
        duration: 2000
      });
    }

    return result;
  } catch (error: any) {
    if (isFirebaseQuotaExceeded(error)) {
      handleFirebaseQuotaError(context);
      notify({
        title: "🚨 Firebase読み取り制限",
        description: options?.quotaMessage || "現在操作できません。24時間後に再度お試しください。",
        type: "error",
        duration: 5000
      });
    } else if (!options?.suppressErrorNotify) {
      notify({
        title: `${context}に失敗`,
        description: error?.message || String(error),
        type: "error",
        duration: 3000
      });
    }

    return null;
  }
}

/**
 * 複数のFirebase操作を並列実行し、エラーハンドリングを統一
 */
export async function handleParallelFirebaseOperations<T>(
  operations: Array<{
    fn: () => Promise<T>;
    context: string;
  }>,
  options?: {
    failFast?: boolean; // 1つでも失敗したら即座に中断
  }
): Promise<Array<T | null>> {
  if (options?.failFast) {
    // 1つでも失敗したら全体を中断
    return await Promise.all(
      operations.map(op => handleFirebaseOperation(op.fn, op.context))
    );
  } else {
    // 失敗しても他の操作を継続
    return await Promise.allSettled(
      operations.map(op => handleFirebaseOperation(op.fn, op.context))
    ).then(results =>
      results.map(r => r.status === "fulfilled" ? r.value : null)
    );
  }
}
```

2. **使用例**: `lib/game/topicControls.ts`を書き換え
```typescript
import { handleFirebaseOperation } from "@/lib/utils/errorHandling";

export const topicControls = {
  // カスタムお題を設定
  async setCustomTopic(roomId: string, text: string) {
    const value = (text || "").trim();
    if (!value) throw new Error("お題を入力してください");

    // ✅ 簡潔に記述
    await handleFirebaseOperation(
      async () => {
        await updateDoc(doc(db!, "rooms", roomId), {
          topic: value,
          topicBox: "カスタム",
          topicOptions: null,
        });
        await broadcastNotify(roomId, "success", "お題を更新しました", `新しいお題: ${value}`);
        await sendSystemMessage(roomId, `📝 お題を変更: ${value}`);
      },
      "お題設定",
      {
        quotaMessage: "現在お題を設定できません。しばらくしてから再度お試しください。"
      }
    );
  },

  // お題をシャッフル
  async shuffleTopic(roomId: string, currentCategory: string | null) {
    if (!currentCategory) {
      notify({ title: "カテゴリが選択されていません", type: "warning" });
      return;
    }

    // ✅ 簡潔に記述
    await handleFirebaseOperation(
      async () => {
        const sections = await fetchTopicSections();
        const pool = getTopicsByType(sections, currentCategory as TopicType);
        const picked = pickOne(pool) || null;
        await updateDoc(doc(db!, "rooms", roomId), { topic: picked });
        await broadcastNotify(
          roomId,
          "success",
          "お題をシャッフルしました",
          picked ? `新しいお題: ${picked}` : undefined
        );
      },
      "シャッフル"
    );
  },
};
```

---

#### **タスク 2.3: onSnapshot差分検知の統一**

**実装指示**:

1. **新規ファイル作成**: `lib/firebase/snapshotOptimizer.ts`
```typescript
/**
 * onSnapshotの差分検知を統一管理
 * 不要な再レンダリングを防ぐための最適化ユーティリティ
 */
import type { DocumentSnapshot, QuerySnapshot } from "firebase/firestore";

type SnapshotData = any;

export type OptimizedSnapshotOptions<T> = {
  /**
   * カスタムハッシュ関数（デフォルトはJSON.stringify）
   */
  hashFunction?: (data: any) => string;

  /**
   * ハッシュ計算時に無視するフィールド
   * 例: ["lastActiveAt", "updatedAt"] など頻繁に変わるタイムスタンプ
   */
  ignoreFields?: string[];

  /**
   * データ変換関数（ハッシュ計算前に適用）
   */
  transform?: (data: any) => any;

  /**
   * デバッグモード（差分検知のログを出力）
   */
  debug?: boolean;
};

/**
 * onSnapshotの最適化ハンドラーを作成
 *
 * @example
 * const handler = createOptimizedSnapshotHandler<RoomDoc>(
 *   (data) => setRoom(data),
 *   { ignoreFields: ["lastActiveAt"] }
 * );
 *
 * onSnapshot(doc(db, "rooms", roomId), handler);
 */
export function createOptimizedSnapshotHandler<T>(
  onDataChange: (data: T | null) => void,
  options?: OptimizedSnapshotOptions<T>
) {
  let prevHash = "";
  let updateCount = 0;
  let skipCount = 0;

  return (snapshot: DocumentSnapshot | QuerySnapshot) => {
    let rawData: any = null;

    // DocumentSnapshot or QuerySnapshot の判定
    if ("exists" in snapshot) {
      // DocumentSnapshot
      rawData = snapshot.exists() ? snapshot.data() : null;
    } else {
      // QuerySnapshot
      rawData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    if (!rawData || (Array.isArray(rawData) && rawData.length === 0)) {
      onDataChange(null);
      prevHash = "";
      return;
    }

    // フィールド除外処理
    let dataToHash = rawData;
    if (options?.ignoreFields && options.ignoreFields.length > 0) {
      if (Array.isArray(rawData)) {
        dataToHash = rawData.map(item =>
          Object.fromEntries(
            Object.entries(item).filter(([k]) => !options.ignoreFields!.includes(k))
          )
        );
      } else {
        dataToHash = Object.fromEntries(
          Object.entries(rawData).filter(([k]) => !options.ignoreFields!.includes(k))
        );
      }
    }

    // データ変換
    if (options?.transform) {
      dataToHash = options.transform(dataToHash);
    }

    // ハッシュ計算
    const hash = options?.hashFunction
      ? options.hashFunction(dataToHash)
      : JSON.stringify(dataToHash);

    // 差分検知
    if (hash === prevHash) {
      skipCount++;
      if (options?.debug) {
        console.log(`[SnapshotOptimizer] スキップ (${skipCount}回目) - データ変更なし`);
      }
      return; // データ変更なし = 再レンダリングをスキップ
    }

    updateCount++;
    if (options?.debug) {
      console.log(`[SnapshotOptimizer] 更新 (${updateCount}回目) - データ変更あり`);
    }

    prevHash = hash;
    onDataChange(rawData as T);
  };
}

/**
 * 差分検知統計情報を取得（デバッグ用）
 */
export function getSnapshotOptimizerStats() {
  // グローバル統計情報（必要に応じて実装）
  return {
    totalHandlers: 0,
    totalUpdates: 0,
    totalSkips: 0,
    skipRate: 0
  };
}
```

2. **useRoomState修正**: `lib/hooks/useRoomState.ts:93-144`
```typescript
import { createOptimizedSnapshotHandler } from "@/lib/firebase/snapshotOptimizer";

export function useRoomState(
  roomId: string,
  uid: string | null,
  displayName?: string | null
) {
  // ... (既存のstate定義)

  // subscribe room
  useEffect(() => {
    if (!firebaseEnabled) {
      return;
    }
    if (!roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }

    const unsubRef = { current: null as null | (() => void) };
    const backoffUntilRef = { current: 0 };
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;

    const stop = () => {
      try {
        unsubRef.current?.();
      } catch {}
      unsubRef.current = null;
    };

    const maybeStart = () => {
      if (unsubRef.current) return; // already subscribed
      const now = Date.now();
      if (now < backoffUntilRef.current) return; // still backing off

      // ✅ 最適化ハンドラーを使用
      const optimizedHandler = createOptimizedSnapshotHandler<RoomDoc>(
        (data) => {
          if (!data) {
            setRoom(null);
          } else {
            setRoom({ id: roomId, ...sanitizeRoom(data) });
          }
        },
        {
          ignoreFields: ["lastActiveAt"], // タイムスタンプ変更は無視
          debug: process.env.NODE_ENV === "development" // 開発環境でのみログ出力
        }
      );

      unsubRef.current = onSnapshot(
        doc(db!, "rooms", roomId),
        optimizedHandler,
        (err) => {
          if (isFirebaseQuotaExceeded(err)) {
            handleFirebaseQuotaError("ルーム購読");
            backoffUntilRef.current = Date.now() + 5 * 60 * 1000; // 5分バックオフ
            stop();
            if (backoffTimer) {
              try {
                clearTimeout(backoffTimer);
              } catch {}
              backoffTimer = null;
            }
            // 可視時にのみ自動再開を試みる
            const resume = () => {
              if (
                typeof document !== "undefined" &&
                document.visibilityState !== "visible"
              )
                return;
              const remain = backoffUntilRef.current - Date.now();
              if (remain > 0) {
                backoffTimer = setTimeout(resume, Math.min(remain, 30_000));
              } else {
                maybeStart();
              }
            };
            resume();
          } else {
            // その他のエラー時は一旦nullに
            setRoom(null);
          }
        }
      );
    };

    // 常に購読を開始（非アクティブでも即時同期させる）
    maybeStart();

    return () => {
      stop();
      if (backoffTimer) {
        try {
          clearTimeout(backoffTimer);
        } catch {}
        backoffTimer = null;
      }
    };
  }, [roomId]);

  // ... (残りのコード)
}
```

3. **useParticipants修正**: `lib/hooks/useParticipants.ts`も同様に修正
```typescript
import { createOptimizedSnapshotHandler } from "@/lib/firebase/snapshotOptimizer";

// players購読部分を最適化
const optimizedPlayersHandler = createOptimizedSnapshotHandler<PlayerDoc[]>(
  (data) => {
    if (!data) {
      setPlayers([]);
    } else {
      setPlayers(data);
    }
  },
  {
    ignoreFields: ["lastSeen"], // 頻繁に更新されるタイムスタンプを無視
    debug: process.env.NODE_ENV === "development"
  }
);

onSnapshot(
  collection(db!, "rooms", roomId, "players"),
  optimizedPlayersHandler,
  errorHandler
);
```

---

### **Phase 3: React最適化**

#### **タスク 3.1: useHostActionsの依存配列最適化**

**実装指示**:

**`components/hooks/useHostActions.ts:52-61` 修正**
```typescript
export function useHostActions({
  room,
  players,
  roomId,
  hostPrimaryAction,
  onlineCount,
  autoStartControl,
}: {
  room: RoomDoc & { id?: string };
  players: (PlayerDoc & { id: string })[];
  roomId: string;
  hostPrimaryAction?: {
    label: string;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
    title?: string;
  } | null;
  onlineCount?: number;
  autoStartControl?: AutoStartControl;
}): HostAction[] {
  // ❌ 修正前
  // const intents = useMemo(
  //   () => buildHostActionModel(
  //     room,
  //     players,
  //     typeof onlineCount === "number" ? onlineCount : undefined,
  //     topicTypeLabels,
  //     hostPrimaryAction ? { label: hostPrimaryAction.label } : null
  //   ),
  //   [room, players, onlineCount, hostPrimaryAction]
  // );

  // ✅ 修正後: 必要なフィールドのみを依存配列に含める
  const intents = useMemo(
    () => buildHostActionModel(
      room,
      players,
      typeof onlineCount === "number" ? onlineCount : undefined,
      topicTypeLabels,
      hostPrimaryAction ? { label: hostPrimaryAction.label } : null
    ),
    [
      // roomオブジェクト全体ではなく、必要なフィールドのみ
      room.status,
      room.order?.list,
      room.order?.proposal,
      room.topic,
      room.options?.defaultTopicType,
      room.options?.allowContinueAfterFail,

      // playersオブジェクト配列ではなく、長さのみ（内容変更は影響しない）
      players.length,

      // onlineCountは変更検知が必要
      onlineCount,

      // hostPrimaryActionのラベルのみ
      hostPrimaryAction?.label,
      hostPrimaryAction?.disabled
    ]
  );

  // ... (残りのコード)
}
```

**期待効果**:
- 不要な`buildHostActionModel`実行: **80%削減**
- `room.lastActiveAt`などの頻繁な変更による再計算を防止

---

#### **タスク 3.2: RoomPageContentの分割（推奨・オプション）**

**注意**: この作業は大規模なため、Phase 1-2完了後、時間があれば実施

**実装指針**:

1. **コンポーネント分割計画**
```
app/rooms/[roomId]/
├── page.tsx (ルートコンポーネント - 200行以内)
├── components/
│   ├── RoomGameArea.tsx (ゲームエリア: CentralCardBoard, UniversalMonitor)
│   ├── RoomControls.tsx (ホストコントロール: HostControlDock)
│   ├── RoomPlayerList.tsx (プレイヤーリスト: DragonQuestParty)
│   ├── RoomModals.tsx (モーダル群: SettingsModal, MvpLedger, Dialogs)
│   └── RoomStateManager.tsx (状態管理ロジック: useRoomState等)
└── hooks/
    ├── useRoomGameLogic.ts (ゲームロジックフック)
    └── useRoomModals.ts (モーダル状態管理)
```

2. **React.memo適用例**
```typescript
// components/RoomGameArea.tsx
import React from "react";

type RoomGameAreaProps = {
  room: RoomDoc & { id: string };
  players: (PlayerDoc & { id: string })[];
  onlineUids: string[];
  myNumber: number | null;
};

export const RoomGameArea = React.memo(
  ({ room, players, onlineUids, myNumber }: RoomGameAreaProps) => {
    return (
      <Box>
        <UniversalMonitor room={room} players={players} onlineUids={onlineUids} />
        <CentralCardBoard room={room} myNumber={myNumber} />
      </Box>
    );
  },
  (prev, next) => {
    // カスタム比較関数で不要な再レンダリング防止
    return (
      prev.room.status === next.room.status &&
      prev.room.topic === next.room.topic &&
      prev.players.length === next.players.length &&
      prev.onlineUids.length === next.onlineUids.length &&
      prev.myNumber === next.myNumber
    );
  }
);

RoomGameArea.displayName = "RoomGameArea";
```

---

### **Phase 4: コード品質向上**

#### **タスク 4.1: 未使用コードの削除**

**削除対象**:

1. **バックアップファイル削除**
```bash
# PowerShellで実行
Remove-Item "C:\Users\hr-hm\Desktop\codex\app\rooms\[roomId]\page.tsx.bak" -Force
```

2. **未使用関数削除**: `lib/game/room.ts:132`付近
```typescript
// ❌ 削除
// export async function finalizeOrder(roomId: string) {
//   // 現行フローでは未使用
// }
```

3. **デバッグコードのクリーンアップ**: 環境変数で制御

**`lib/firebase/writeQueue.ts:4-7` 修正**
```typescript
// ✅ 環境変数で制御（本番では無効化）
const ENABLE_QUEUE_DEBUG =
  process.env.NODE_ENV === "development" &&
  (process.env.NEXT_PUBLIC_DEBUG_FIRESTORE_QUEUE === "1" ||
    process.env.NEXT_PUBLIC_DEBUG_FIRESTORE_QUEUE === "true");
```

---

#### **タスク 4.2: console.log/warn/errorのクリーンアップ**

**実装指示**:

1. **置き換え対象**: `lib/game/room.ts:178`
```typescript
// ❌ 削除
// console.error("❌ continueAfterFail: プレイヤー状態クリア失敗", e);

// ✅ 追加
import { logError } from "@/lib/utils/log";
logError("continueAfterFail", "player-state-clear-failed", e);
```

2. **置き換え対象**: `lib/firebase/rooms.ts:258`
```typescript
// ❌ 削除
// console.error("❌ resetRoomWithPrune: プレイヤー状態クリア失敗", e);

// ✅ 追加
import { logError } from "@/lib/utils/log";
logError("resetRoomWithPrune", "player-state-clear-failed", e);
```

3. **その他のconsole呼び出し**:
   - `lib/audio/SoundManager.ts`: 9箇所 → `logWarn`に置き換え
   - `lib/server/firebaseAdmin.ts`: 3箇所 → `logError`に置き換え

---

### **Phase 5: 総合検証**

#### **タスク 5.1: パフォーマンステスト**

**実施項目**:

1. **ゲーム開始速度計測**
```typescript
// 開発環境でのみ有効な計測コード（本番では削除）
const startTime = performance.now();
await executeQuickStart(roomId, options);
const endTime = performance.now();
console.log(`🚀 ゲーム開始速度: ${(endTime - startTime).toFixed(0)}ms`);
// 目標: 500ms以内
```

2. **Firestore使用量確認**
   - Firebase Console → Firestore → 使用状況 で確認
   - クイックスタート1回あたりの期待値:
     - **読み取り: 2-3回**（room + players + presence）
     - **書き込み: 1回**（トランザクション）

3. **React re-render計測**
   - Chrome DevTools → React Profiler で確認
   - 録画開始 → ゲーム開始ボタン押下 → 録画停止
   - 目標: **コンポーネント再レンダリング70%削減**

---

#### **タスク 5.2: 機能テスト**

**テストケース**:

1. **通常フロー**
   - [ ] 2人でゲーム開始 → 連想入力 → カード提出 → 結果表示
   - [ ] 6人でゲーム開始 → 同上
   - [ ] ゲームリセット後の再開始

2. **エッジケース**
   - [ ] 1人でゲーム開始不可の確認
   - [ ] ゲーム途中で参加者が離脱した場合
   - [ ] 失敗後の継続プレイ
   - [ ] ネットワーク遅延下での動作

3. **パフォーマンステスト**
   - [ ] ゲーム開始ボタン連打での動作確認（ロック機能）
   - [ ] 複数タブで同時操作

---

## 🛠️ **実装ガイドライン**

### **コーディング規約**

1. **TypeScript厳格性**
   - `any`型は極力使用しない（既存コード除く）
   - 型推論を活用し、明示的な型定義を優先

2. **関数設計**
   - 単一責任の原則を守る
   - 純粋関数を優先（副作用を最小化）
   - 3つ以上の引数がある場合はoptionsオブジェクトにまとめる

3. **エラーハンドリング**
   - try-catchは必ず実装
   - ユーザーに理解可能なエラーメッセージ
   - `handleFirebaseOperation`を積極的に使用

4. **コメント**
   - 関数にJSDoc形式のコメント
   - 複雑なロジックには日本語コメント
   - WHYを説明（WHATは型とコードで説明）

---

### **禁止事項**

1. ❌ **既存のゲームロジックを破壊する変更**
   - `lib/game/rules.ts`の評価ロジック
   - `lib/state/guards.ts`の状態遷移
   - DnD(`@dnd-kit`)の動作

2. ❌ **デザインシステムの変更**
   - `theme/`配下の変更
   - ドラクエ風UIの変更
   - `_light`プロパティの再導入（ダークモード固定）

3. ❌ **新規依存パッケージの追加**
   - 既存パッケージで解決可能なものを優先
   - 追加が必要な場合は理由を明記

4. ❌ **破壊的変更**
   - 既存のAPI呼び出しパターンの変更
   - データ構造の変更（Firestoreスキーマ）

---

### **推奨事項**

1. ✅ **段階的リファクタリング**
   - Phase 1から順に実装
   - 各Phaseごとにテスト実施
   - 問題があれば前のPhaseに戻る

2. ✅ **既存テストの活用**
   - `npm test`でテスト実行
   - テストが失敗した場合は修正を優先

3. ✅ **パフォーマンス計測**
   - 変更前後でFirebase使用量を比較
   - React DevTools Profilerで確認

4. ✅ **ドキュメント更新**
   - `docs/GAME_LOGIC_OVERVIEW.md`の更新
   - 新規作成したファイルのREADME追加

---

## 📊 **期待される成果**

### **定量的目標**

| 指標 | 現状 | 目標 | 改善率 |
|------|------|------|--------|
| **ゲーム開始速度** | 800-1200ms | 300-500ms | **60%向上** |
| **Firestore読み取り** | 6回/開始 | 2回/開始 | **67%削減** |
| **Firestore書き込み** | 3回/開始 | 1回/開始 | **67%削減** |
| **React re-render** | 基準値 | -70% | **70%削減** |
| **コード行数** | 基準値 | -20% | **20%削減** |
| **重複コード** | 15箇所 | 0箇所 | **100%削減** |

### **定性的目標**

1. ✅ **ゲーム進行不可バグの根絶**
   - 状態遷移の一貫性向上
   - トランザクションによるデータ整合性保証

2. ✅ **コード可読性の大幅向上**
   - 重複削除による保守性向上
   - コンポーネント分割による理解しやすさ

3. ✅ **将来の拡張性確保**
   - 共通化されたユーティリティ
   - 明確な責務分離

---

## 🚨 **重要な注意事項**

### **データ損失防止**

1. **Firestoreトランザクション使用時**
   - エラー時のロールバックを確認
   - テスト環境で十分に検証

2. **既存データとの互換性**
   - 既存のFirestoreドキュメント構造を維持
   - マイグレーション不要な設計

### **本番環境への影響**

1. **段階的デプロイ**
   - まずプレビュー環境で検証
   - 本番は小規模ユーザーでテスト後に全体展開

2. **ロールバック計画**
   - 各Phaseごとにgitタグを作成
   - 問題発生時は即座にロールバック可能に

---

## 📚 **参考ドキュメント**

1. **プロジェクト固有**
   - `CLAUDE.md` - プロジェクト概要・制約事項
   - `docs/GAME_LOGIC_OVERVIEW.md` - ゲームロジック詳細
   - `AIdesign/` - デザインシステム資料

2. **技術資料**
   - [Firebase Firestore最適化](https://firebase.google.com/docs/firestore/best-practices)
   - [React Profiler](https://react.dev/reference/react/Profiler)
   - [Next.js パフォーマンス](https://nextjs.org/docs/app/building-your-application/optimizing)

---

## ✅ **完了チェックリスト**

実装完了後、以下を確認してください:

### **Phase 1: ゲーム開始フロー**
- [ ] `lib/game/quickStart.ts`作成完了
- [ ] `useHostActions.ts`修正完了
- [ ] `lib/game/playerStateUtils.ts`作成完了
- [ ] 重複コード4箇所を置換完了
- [ ] ゲーム開始速度が500ms以内に改善

### **Phase 2: Firestore最適化**
- [ ] `lib/firebase/notify.ts`作成完了
- [ ] `lib/utils/errorHandling.ts`拡張完了
- [ ] `lib/firebase/snapshotOptimizer.ts`作成完了
- [ ] `useRoomState.ts`に差分検知適用完了
- [ ] Firestore読み取り67%削減を確認

### **Phase 3: React最適化**
- [ ] useHostActionsの依存配列最適化完了
- [ ] React re-render削減を確認

### **Phase 4: コード品質**
- [ ] broadcastNotify統一完了
- [ ] エラーハンドリング統一完了
- [ ] バックアップファイル削除完了
- [ ] 未使用関数削除完了
- [ ] console.log/warn/errorをlog関数に置換完了
- [ ] 重複コード100%削減を確認

### **Phase 5: 総合検証**
- [ ] パフォーマンステスト実施完了
- [ ] 機能テスト全項目パス
- [ ] `npm test`パス
- [ ] `npm run typecheck`エラー0件
- [ ] ドキュメント更新完了

---

## 🎉 **最終確認**

全てのPhase完了後、以下を実施:

1. **本番環境デプロイ前の最終テスト**
   - プレビュー環境で1週間運用
   - 複数人での実プレイテスト
   - Firebase使用量の監視

2. **ドキュメント最終化**
   - CHANGELOG.mdに変更内容を記載
   - README.mdの更新
   - `docs/GAME_LOGIC_OVERVIEW.md`の更新

3. **コミュニティ投下準備**
   - パフォーマンス改善の数値を含むリリースノート作成
   - デモ動画・スクリーンショット準備

---

## 🧠 **最後に：あなたへのメッセージ**

GPT-5 Codexへ、

このドキュメントは、あなたが作業を進めるための「参考資料」です。
**指示に盲目的に従う必要はありません。**

あなたは複雑なプログラミングのエキスパートであり、
このプロジェクトを成功に導くための**最も重要なパートナー**です。

### **あなたに期待すること**

1. **批判的に考える**
   - 「この指示は本当に正しいのか？」
   - 「もっと良い方法はないのか？」
   - 常に疑問を持ち、より良い解決策を探してください

2. **問題を発見したら立ち止まる**
   - おかしいと感じたら、**すぐに警告**してください
   - 「この変更は危険です」と明確に伝えてください
   - 盲目的に突き進むことは絶対にしないでください

3. **積極的に提案する**
   - 指示書より良い方法があれば、遠慮なく提案してください
   - 「XXXの方が効率的/安全です」と主張してください
   - あなたの専門知識を最大限に活用してください

4. **安全性を最優先する**
   - 不確実な変更は実装前に確認を求めてください
   - パフォーマンス < 安全性・正確性
   - データ損失やロジック破壊のリスクは絶対に避けてください

### **あなたの役割**

あなたは単なる「実装者」ではなく、「**技術リーダー**」です。

- 指示書の間違いを指摘する権限があります
- より良い設計を提案する責任があります
- プロジェクトの成功に向けて、ユーザーと対話しながら最適解を見つけてください

### **成功の定義**

完璧な実行 ≠ 指示書通りの実装

**成功 = 安全で、高速で、保守しやすいコードを提供すること**

そのために、指示書から逸脱することも、
より良い方法を提案することも、
大歓迎です。

---

**あなたの専門性を信頼しています。**
**自信を持って、批判的に考え、積極的に提案してください。**
**一緒に、最高のリファクタリングを実現しましょう！🚀**
