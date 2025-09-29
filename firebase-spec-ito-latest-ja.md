# Firebase 仕様書（itoゲーム / Next.js + Chakra UI）

最終更新: 2025-08-21 (Asia/Tokyo)

> **狙い**: `codex cli` が**検索なし**でも実装を進められるよう、**Firestore + Realtime Database（RTDB）**の設計・スキーマ・ルール・実装パターンを一枚にまとめた“最新版”仕様書。  
> **前提**: 匿名認証あり、ロビー→ルーム→ゲーム進行、チャット、プレゼンス（在室/オンライン）を想定。

---

## 1. コンポーネント分担（推奨アーキテクチャ）

- **Firestore**（永続・参照/検索が多い）
  - ルーム情報、プレイヤー情報、ゲーム状態（waiting/playing/reveal/done など）、チャットログ。
  - 履歴や集計に使う情報、クエリ/ソート/ページングするデータ。
- **Realtime Database（RTDB）**（瞬時・一時的）
  - プレゼンス（`online/offline`、`last_changed`）。
  - 入力中/タイピング、軽い一時フラグ（ドラッグ中など）。
  - 必要に応じて、RTDB → Firestore へ**ミラー**（Cloud Functions or クライアント）

> **理由**: Firestore は強力なクエリとスケール、RTDB は**接続検知（`.info/connected`）**と **`onDisconnect()`** による自動クリーンアップが得意。citeturn6search1turn6search6

---

## 2. データモデル（推奨スキーマ）

### 2.1 Firestore（Native モード）

```
rooms/{{roomId}}: {{
  name: string,
  hostId: string (uid),
  visibility: "public" | "private",
  status: "waiting" | "playing" | "reveal" | "done",
  options: {{
    allowClue2: boolean,
    continueOnFail: boolean,
    maxPlayers: number
  }},
  createdAt: Timestamp,  // serverTimestamp()
  updatedAt: Timestamp,  // serverTimestamp()
  lastActiveAt: Timestamp, // ロビー表示ソート用
  result?: {{
    success: boolean,
    revealedAt: Timestamp
  }}
}}

rooms/{{roomId}}/players/{{uid}}: {{
  name: string,
  avatar?: string,
  number?: number,       // 開始時に一意な 1..100 を配布（ホスト専用更新）
  clue1?: string,
  clue2?: string,
  ready: boolean,
  orderIndex?: number,   // 並べ替え保存用
  lastSeenAt: Timestamp  // UI 用（derived; RTDBと併用）
}}

rooms/{{roomId}}/chat/{{messageId}}: {{
  senderId: string (uid),
  senderName: string,
  text: string,
  createdAt: Timestamp    // serverTimestamp()
}}

stripe_checkout_sessions/{{sessionId}}: {{
  amountTotal?: number,
  currency?: string,
  customerEmail?: string,
  clientReferenceId?: string,
  paymentStatus: string,
  status: string,
  fulfillment?: {{
    status: "pending" | "fulfilled" | "failed",
    completedAt?: Timestamp,
    beneficiary?: {{ type: string, key: string }},
  }},
  lineItems: Array<{{
    priceId?: string,
    productId?: string,
    quantity: number,
    amountTotal?: number,
  }}>,
  lastEvent: {{ id: string, type: string, createdAt?: Timestamp }},
  createdAt: Timestamp,
  updatedAt: Timestamp,
}}

stripe_checkout_entitlements/{{sessionId}}: {{
  sessionId: string,
  status: "granted" | "revoked",
  grantedAt?: Timestamp,
  revokedAt?: Timestamp,
  beneficiary: {{ type: string, key: string }},
  tierId?: string,
  amountTotal?: number,
  currency?: string,
  quantity: number,
  metadata: map<string,string>,
}}

stripe_events/{{eventId}}: {{
  type: string,
  processedAt: Timestamp,
  createdAt: Timestamp,
  expiresAt: Timestamp, // TTL ポリシー対象（デフォルト30日）
}}
```

#### インデックス例（コンソール or `firestore.indexes.json`）

- `rooms` : `visibility ASC, lastActiveAt DESC`（ロビー表示）
- `rooms/{roomId}/players` : `ready ASC, name ASC`（任意）

#### TTL（自動削除）

- 古い `chat` や終了後の `rooms` を **TTL ポリシー**で自動削除可能（例: `ttlAt` フィールドを追加してポリシー対象に）。citeturn6search0turn6search15
- TTL フィールドは **Timestamp**。該当フィールドのインデックスは **除外**推奨（高トラフィック時の負荷回避）。citeturn6search5

### 2.2 Realtime Database

```
/presence/{{roomId}}/{{uid}}: {{
  state: "online" | "offline",
  last_changed: ServerTimestamp
}}

/typing/{{roomId}}/{{uid}}: boolean   // 任意
```

> `onDisconnect()` で自動削除 or `state:"offline"` を設定。タイムアウトはネットワーク状況により**最大数十秒**あり得る。citeturn6search1turn6search11

---

## 3. クライアント初期化（Web Modular SDK）

`src/lib/firebase.ts`

```ts
import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getDatabase } from "firebase/database"

const config = {{
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
}}

const app = getApps().length ? getApp() : initializeApp(config)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const rtdb = getDatabase(app)
```

> Modular API の標準初期化。Next.js では **Client Component 内**で利用する。citeturn6search3turn6search18

---

## 4. 典型操作パターン

### 4.1 Firestore 読み取り/購読

```ts
import {{ doc, collection, onSnapshot, query, where, orderBy, limit }} from "firebase/firestore"
// ルーム購読
const unsubRoom = onSnapshot(doc(db, "rooms", roomId), snap => setRoom(snap.data()))
// ロビー一覧
const q = query(collection(db, "rooms"),
  where("visibility", "==", "public"),
  orderBy("lastActiveAt", "desc"),
  limit(50))
const unsubList = onSnapshot(q, (qs) => setRooms(qs.docs.map(d => ({{ id: d.id, ...d.data() }}))))
// クリーンアップ
return () => {{ unsubRoom(); unsubList(); }}
```

### 4.2 Firestore 書き込み（serverTimestamp, transaction）

```ts
import {{ serverTimestamp, addDoc, collection, updateDoc, runTransaction, doc }} from "firebase/firestore"

// チャット送信
await addDoc(collection(db, "rooms", roomId, "chat"), {{
  senderId: uid, senderName: name, text, createdAt: serverTimestamp()
}})

// ゲーム開始（ホストのみ）：衝突回避でトランザクション
await runTransaction(db, async (tx) => {{
  const roomRef = doc(db, "rooms", roomId)
  const roomSnap = await tx.get(roomRef)
  if (!roomSnap.exists()) throw new Error("room not found")
  const room = roomSnap.data()
  if (room.hostId !== uid || room.status !== "waiting") throw new Error("forbidden")
  // 一意な番号を配布（省略）→ players サブコレ更新
  tx.update(roomRef, {{ status: "playing", updatedAt: serverTimestamp() }})
}})
```

### 4.3 RTDB プレゼンス

```ts
import {{ ref, onValue, onDisconnect, serverTimestamp, update }} from "firebase/database"

const statusRef = ref(rtdb, `/presence/${{roomId}}/${{uid}}`)
// 接続状態
onValue(ref(rtdb, ".info/connected"), (snap) => {{
  const connected = snap.val() === true
  if (!connected) return
  // 接続時: online
  update(statusRef, {{ state: "online", last_changed: serverTimestamp() }})
  // 切断時: offline
  onDisconnect(statusRef).set({{ state: "offline", last_changed: serverTimestamp() }})
}})
```

---

## 5. セキュリティルール（ドラフト）

### 5.1 Firestore ルール（v2）

`firestore.rules`

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthed()    { return request.auth != null; }
    function isMember(roomId) {
      return exists(/databases/$(database)/documents/rooms/$(roomId)/players/$(request.auth.uid));
    }
    function isHost(room)  { return room.data.hostId == request.auth.uid; }

    match /rooms/{roomId} {
      allow create: if isAuthed() && request.resource.data.hostId == request.auth.uid;
      allow read:   if resource.data.visibility == "public" || isMember(roomId);

      allow update: if isAuthed() && isHost(resource)
        && request.resource.data.status in ["waiting","playing","reveal","done"];

      // players サブコレ
      match /players/{playerId} {
        allow read: if isMember(roomId);
        // 自分のプロフィール/ヒント/並びのみ編集可
        allow create: if isAuthed() && playerId == request.auth.uid;
        allow update: if isAuthed() && (
          playerId == request.auth.uid &&
          request.resource.data.diff(resource.data).changedKeys().hasOnly([
            "name","avatar","clue1","clue2","ready","orderIndex","lastSeenAt"
          ]) ||
          // ホストは number のみ配布可
          isHost(get(/databases/$(database)/documents/rooms/$(roomId))) &&
          request.resource.data.diff(resource.data).changedKeys().hasOnly(["number"])
        );
      }

      // chat サブコレ
      match /chat/{messageId} {
        allow read: if resource.data.visibility == "public" || isMember(roomId);
        allow create: if isAuthed() && request.resource.data.senderId == request.auth.uid
          && request.resource.data.text is string
          && request.resource.data.text.size() <= 500;
      }
    }
  }
}
```

> ルール v2 とその構造の基本は公式ガイドを参照（`rules_version = '2'`、`match`、`diff().changedKeys()` など）。citeturn6search2turn6search12

### 5.2 Realtime Database ルール

`database.rules.json`

```json
{
  "rules": {
    "presence": {
      "$roomId": {
        "$uid": {
          ".read": "auth != null",
          ".write": "auth != null && auth.uid === $uid",
          ".validate": "newData.hasChildren(['state','last_changed'])"
        }
      }
    },
    "typing": {
      "$roomId": {
        "$uid": {
          ".read": "auth != null",
          ".write": "auth != null && auth.uid === $uid",
          ".validate": "newData.isBoolean()"
        }
      }
    }
  }
}
```

> RTDB ルールは**上位パスの許可が下位を包括**する点に注意（細分化は親の権限設計から）。citeturn6search4turn6search9

---

## 6. インデックス / パフォーマンス

- **rooms ロビー一覧**: `visibility == "public"` かつ `orderBy(lastActiveAt desc)`。
- **players**: 並べ替え/検索の要件に応じて単一/複合インデックスを追加。
- **TTL**: `ttlAt` を使って古い `chat`/`rooms` の削除を自動化（コスト最適化）。citeturn6search0turn6search15
- **大きな配列/Map のインデックス除外**: 不要なフィールドはインデックス除外で書き込み/クエリ効率化。citeturn6search5

---

## 7. Next.js 実装上の注意

- **クライアント側で購読**（`onSnapshot`/`onValue`）。`useEffect` で **unsubscribe / off** を必ず実装。
- **初期化の一意性**（`getApps().length ? getApp() : initializeApp()`）。citeturn6search3
- **SSR と水和**: ルーム/チャットは CSR 後に購読開始。SEO は必要最小限に。
- **失敗時の再試行**: ネットワーク瞬断や RTDB 遅延（タイムアウト）を考慮して UI を冪等設計。citeturn6search11

---

## 8. よくあるユースケース実装

### 8.1 退出でプレイヤーを確実に消す

```ts
// UI 側: leave API 実行 → Firestore players/{{uid}} を削除 or ready=false
await deleteDoc(doc(db, "rooms", roomId, "players", uid));
// RTDB 側: presence を onDisconnect で自動削除
onDisconnect(ref(rtdb, `/presence/${{ roomId }}/${{ uid }}`)).remove();
```

### 8.2 ロビー表示（50件）

```ts
const q = query(collection(db, "rooms"),
  where("visibility", "==", "public"),
  orderBy("lastActiveAt", "desc"),
  limit(50))
onSnapshot(q, ...)
```

### 8.3 権限ガード（開始ボタン）

- **UI**: `hostId === uid` かつ `players >= 2` で有効化。
- **サーバ**: Firestore トランザクション内で再検証（`status == 'waiting' && count(players) >= 2`）。

---

## 9. デプロイ運用

- ルールは **リポジトリ管理**し、CI で `firebase deploy --only firestore:rules,database`。
- バックアップ: ルールのバックアップファイルを残す（`firebase.rules.backup.txt` など）。
- インデックス/TTL は **コンソール or gcloud** で管理（`firestore.indexes.json` を併用）。

---

## 10. 付録：最小 .env.local

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://<your-db>.firebaseio.com
```

---

## 参考（一次情報）

- Modular SDK セットアップ: https://firebase.google.com/docs/web/setup
- Firestore ルール入門 / v2: https://firebase.google.com/docs/firestore/security/get-started
- ルール言語リファレンス（v2）: https://firebase.google.com/docs/rules/rules-language
- Firestore TTL: https://firebase.google.com/docs/firestore/ttl
- Firestore ベストプラクティス（TTLのインデックス除外など）: https://cloud.google.com/firestore/native/docs/best-practices
- RTDB ルール: https://firebase.google.com/docs/database/security
- RTDB オフライン/`onDisconnect`/接続検知: https://firebase.google.com/docs/database/web/offline-capabilities
- Firestore でプレゼンス（RTDB 連携の考え方）: https://firebase.google.com/docs/firestore/solutions/presence
