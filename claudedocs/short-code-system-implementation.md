# 🎯 6文字短縮コードシステム実装指示書

## 📋 実装概要

**目的**: 覚えやすい6文字コードで部屋共有・検索を実現
**設計**: ChatGPT推奨の部屋ID/パスワード分離システム
**優先度**: HIGH - コミュニティ展開の必須機能

## 🎯 システム設計

### **分離アーキテクチャ**
```
部屋コード (6文字): ABC123 ← 公開情報（URL・検索・口頭共有）
パスワード (任意): 1234 ← 秘密情報（友だち間のみ）
内部ID: Firebase長いID ← システム内部のみ使用
```

### **URL構造**
```
https://numberlink.vercel.app/r/ABC123
↓
roomShort/ABC123 → { roomId: "firebase-long-id", status: "open" }
↓
部屋表示（内部IDは隠蔽）
```

## 🛠️ 実装仕様

### **1. 短縮コード生成**

#### 新規ファイル: `lib/utils/shortCode.ts`
```typescript
// ChatGPT推奨: 混同しやすい文字除外
const SHORT_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // I/O/0/1除外

export function generateShortCode(): string {
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += SHORT_CODE_CHARS.charAt(Math.floor(Math.random() * SHORT_CODE_CHARS.length));
  }
  return result;
}

export async function createUniqueShortCode(db: any): Promise<string> {
  let attempts = 0;
  const MAX_ATTEMPTS = 20; // 安全装置

  while (attempts < MAX_ATTEMPTS) {
    const code = generateShortCode();
    const docRef = doc(db, "roomShort", code);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return code;
    }
    attempts++;
  }

  throw new Error("短縮コード生成に失敗しました");
}
```

### **2. Firestore構造拡張**

#### コレクション追加: `roomShort`
```typescript
// roomShort/{CODE} ドキュメント構造
{
  roomId: string;        // 実際のFirebase roomId
  createdAt: Timestamp;  // 作成日時
  status: "open" | "closed"; // 部屋状態
  expiresAt?: Timestamp; // 有効期限（必要に応じて）
}
```

#### 既存 `rooms` コレクションに追加
```typescript
// rooms/{roomId} に追加フィールド
{
  shortCode: string;     // 6文字コード (例: "ABC123")
  // 既存フィールドは維持
}
```

### **3. 部屋作成処理の修正**

#### `components/CreateRoomModal.tsx` の修正
```typescript
// handleCreate 関数内に追加
import { createUniqueShortCode } from "@/lib/utils/shortCode";

try {
  // 1. 短縮コード生成
  const shortCode = await createUniqueShortCode(db);

  // 2. 部屋データに shortCode 追加
  const baseRoomData: RoomDoc & Record<string, any> = {
    // 既存フィールド...
    shortCode, // ← 追加
  };

  // 3. 部屋作成
  const roomRef = await addDoc(collection(db!, "rooms"), baseRoomData);

  // 4. roomShort マッピング作成
  await setDoc(doc(db!, "roomShort", shortCode), {
    roomId: roomRef.id,
    createdAt: serverTimestamp(),
    status: "open",
  });

  // 5. 表示用URLを短縮コードに変更
  setCreatedRoomId(shortCode); // ← roomRef.id から変更
}
```

#### 招待URL表示の修正
```typescript
// inviteUrl の生成を変更
const inviteUrl = useMemo(() => {
  if (!createdRoomId) return "";
  if (typeof window === "undefined") {
    return `/r/${createdRoomId}`; // 短縮コードを直接使用
  }
  return `${window.location.origin}/r/${createdRoomId}`;
}, [createdRoomId]);
```

### **4. URL解決システム**

#### 新規ファイル: `app/r/[code]/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { getAdminDb } from '@/lib/server/firebaseAdmin';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code.toUpperCase();

    // レート制限チェック（オプション）
    // TODO: IP制限実装 (IP/5s 10回)

    const db = getAdminDb();
    const shortDoc = await getDoc(doc(db, "roomShort", code));

    if (!shortDoc.exists()) {
      return NextResponse.redirect(new URL('/not-found', request.url), 302);
    }

    const { roomId, status } = shortDoc.data();

    if (status === "closed") {
      return NextResponse.redirect(new URL('/room-closed', request.url), 302);
    }

    // 内部IDにリダイレクト（ユーザーには見えない）
    return NextResponse.redirect(new URL(`/rooms/${roomId}`, request.url), 302);

  } catch (error) {
    console.error("Short code resolution failed:", error);
    return NextResponse.redirect(new URL('/error', request.url), 302);
  }
}
```

#### 新規ファイル: `app/r/[code]/page.tsx`
```typescript
import { notFound } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { getAdminDb } from '@/lib/server/firebaseAdmin';

export default async function ShortCodePage({
  params,
}: {
  params: { code: string };
}) {
  const code = params.code.toUpperCase();

  try {
    const db = getAdminDb();
    const shortDoc = await getDoc(doc(db, "roomShort", code));

    if (!shortDoc.exists()) {
      notFound();
    }

    const { roomId } = shortDoc.data();

    // 実際の部屋コンポーネントを表示（内部IDは隠蔽）
    return <RoomPage roomId={roomId} shortCode={code} />;

  } catch (error) {
    console.error("Room loading failed:", error);
    notFound();
  }
}
```

### **5. 検索機能強化**

#### `components/ui/SearchBar.tsx` の修正
```typescript
// 検索処理に短縮コード対応を追加
const handleSearch = (query: string) => {
  const trimmed = query.trim().toUpperCase();

  // 6文字の短縮コードパターンをチェック
  if (trimmed.length === 6 && /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(trimmed)) {
    // 短縮コードの場合は直接ジャンプ
    router.push(`/r/${trimmed}`);
    return;
  }

  // 通常の部屋名検索
  onChange(trimmed);
};
```

### **6. ロビー表示の調整**

#### `app/page.tsx` の修正
```typescript
// 部屋カード表示で短縮コード表示
<RoomCard
  // 既存props...
  shortCode={room.shortCode} // ← 追加
  onJoin={() => handleJoinRoom(room)}
/>
```

#### `components/RoomCard.tsx` の修正
```typescript
// props に shortCode 追加
interface RoomCardProps {
  // 既存props...
  shortCode?: string;
}

// 表示部分に短縮コード追加
{shortCode && (
  <Text fontSize="xs" color="whiteAlpha.70" fontFamily="monospace">
    部屋コード: {shortCode}
  </Text>
)}
```

### **7. 部屋削除時のクリーンアップ**

#### 部屋クローズ処理に追加
```typescript
// 部屋が閉じられる時の処理
export async function closeRoom(roomId: string) {
  const db = getAdminDb();

  // 1. 部屋の shortCode を取得
  const roomDoc = await getDoc(doc(db, "rooms", roomId));
  if (!roomDoc.exists()) return;

  const { shortCode } = roomDoc.data();

  // 2. roomShort のステータス更新
  if (shortCode) {
    await updateDoc(doc(db, "roomShort", shortCode), {
      status: "closed"
    });
  }

  // 3. 既存の部屋クローズ処理...
}
```

## 🎨 UI/UX改善

### **CreateRoomModal表示の改善**
```typescript
// 成功時の表示を短縮コード中心に
<Text>部屋コード: {createdRoomId}</Text>
<Text fontSize="xs">このコードで検索・参加できます</Text>
```

### **エラーページ追加**
- `/not-found` - 存在しない部屋コード
- `/room-closed` - 終了した部屋
- `/error` - システムエラー

## 🔐 セキュリティ考慮

### **レート制限**
```typescript
// IP制限実装（オプション）
const rateLimitKey = `rate_limit:${getClientIP(request)}`;
const attempts = await redis.incr(rateLimitKey);
if (attempts === 1) {
  await redis.expire(rateLimitKey, 5); // 5秒間
}
if (attempts > 10) {
  return new Response("Too Many Requests", { status: 429 });
}
```

### **コード推測対策**
- 6文字 x 32文字 = 約10億通り（十分安全）
- I/O/0/1除外で混同防止
- 定期的な使用状況監視

## 🧪 テスト項目

### **機能テスト**
- [ ] 短縮コード生成（重複なし）
- [ ] URL リダイレクト動作
- [ ] 検索での短縮コード認識
- [ ] パスワード付き部屋との連携
- [ ] 部屋削除時のクリーンアップ

### **UI/UXテスト**
- [ ] 招待URL表示（短縮版）
- [ ] 部屋カードでの短縮コード表示
- [ ] エラーページの表示
- [ ] モバイル対応

### **セキュリティテスト**
- [ ] 存在しないコードの処理
- [ ] 期限切れ部屋の処理
- [ ] レート制限動作（実装時）

## 💡 実装ベストプラクティス

### **データ整合性**
- 部屋作成はトランザクション使用必須
- roomShort と rooms の同期確保
- エラー時のロールバック処理

### **パフォーマンス**
- 短縮コード検索にインデックス設定
- キャッシュ活用（Redis等）
- 不要な roomShort レコードの定期削除

### **ユーザビリティ**
- 短縮コードは常に大文字表示
- エラーメッセージをドラクエ風に統一
- コピー機能の改善

## 🚀 実装順序

### **Phase 1: 基礎システム**
1. `lib/utils/shortCode.ts` 作成
2. CreateRoomModal修正（短縮コード生成）
3. Firestore構造追加

### **Phase 2: URL解決**
1. `app/r/[code]/route.ts` 作成
2. `app/r/[code]/page.tsx` 作成
3. エラーページ作成

### **Phase 3: 検索・UI統合**
1. SearchBar修正（短縮コード検索）
2. RoomCard修正（短縮コード表示）
3. UI/UX最終調整

## ✨ 完成後の体験

### **部屋作成者**
```
部屋作成 → 短縮コード「ABC123」生成 → 友だちに「ABC123で検索して！」
```

### **参加者**
```
「ABC123」入力 → /r/ABC123 にアクセス → 即座に部屋に移動 ✨
```

### **パスワード付きの場合**
```
「ABC123」入力 → パスワードダイアログ → 入室
```

---

**実装目標**: Discord/Meet並みのシンプルさで、ドラクエ風UIの魅力を保持

**技術優先**: 指示書の内容より、実装者の技術的判断を優先してください