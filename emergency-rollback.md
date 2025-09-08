# 🚨 緊急時ロールバック手順

## 問題が発生した場合の復旧方法

### 1. 即座にロールバック
```bash
git checkout HEAD~1 app/page.tsx
npm run dev
```

### 2. useLobbyCounts を再有効化
```typescript
// app/page.tsx で元に戻す
import { useLobbyCounts } from "@/lib/hooks/useLobbyCounts";
const lobbyCounts = useLobbyCounts(roomIds, !!(firebaseEnabled && user));
```

### 3. 確認ポイント
- メインページのルーム一覧表示
- 参加者数の表示
- ルーム参加機能

## ⚠️ 注意
この操作でFirebase読み取りが再び増加するため、制限内での使用を心がけてください。