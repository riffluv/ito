# 🚨 Vercel環境でのプレゼンス問題調査・修正指示書

## 📋 **問題概要**

**症状**: Vercel本番環境で、ブラウザを閉じても参加者一覧からユーザーが削除されない（ゴーストユーザー問題）

**重要**: 数日前までは正常に動作していたが、突然発生した問題

**環境**:
- 本番: https://numberlink.vercel.app/
- 技術スタック: Next.js 14 + Firebase Realtime Database (presence) + Firestore (players)

## 🎯 **調査・修正の最終目標**

1. **根本原因の特定**: なぜ突然動作しなくなったのかを解明
2. **ベストプラクティスでの修正**: Firebase標準機能を活用した正しい実装
3. **再発防止**: 環境変化に強い堅牢な設計への改善

## 🔍 **段階的調査手順**

### **Phase 1: 現在の実装確認**
```bash
# 以下のファイルを詳細に読み取り・分析してください
1. lib/firebase/presence.ts - Firebase RTDB presence実装
2. lib/hooks/useLeaveCleanup.ts - ブラウザ閉じる検知実装
3. lib/firebase/client.ts - Firebase設定とRTDB初期化
4. app/rooms/[roomId]/page.tsx - プレゼンス機能の統合部分
```

**調査ポイント**:
- `onDisconnect()` の実装パターン
- `beforeunload`/`pagehide`イベントの処理
- Firebase Realtime Database接続状態の監視方法
- エラーハンドリングとログ出力の有無

### **Phase 2: Firebase設定検証**
```bash
# Firebase設定の正常性を確認
1. RTDB URLの設定確認
2. セキュリティルールの変更有無
3. Firebase SDK バージョンの確認
4. 環境変数の設定確認
```

**確認コマンド例**:
```javascript
// ブラウザDevToolsで実行してください
console.log('RTDB instance:', rtdb);
console.log('Connected:', rtdb && firebase.database().ref('.info/connected'));
```

### **Phase 3: Vercel環境特有の問題調査**
```bash
# Vercel固有の制約・変更を調査
1. Vercelのネットワーク設定変更
2. WebSocket接続の制限
3. CDN/プロキシの影響
4. serverless関数のタイムアウト
```

**検証項目**:
- WebSocket接続の安定性
- onDisconnect()コールバックの発火タイミング
- ネットワーク遅延・切断の検出精度

### **Phase 4: ログ・デバッグ情報の収集**
```bash
# 詳細なデバッグログを追加
1. presence.ts に詳細ログ追加
2. ブラウザ側でのWebSocket状態監視
3. onDisconnect()の発火確認
4. エラー発生時の詳細情報収集
```

## 🔧 **修正アプローチの優先順位**

### **最優先: Firebase標準機能での修正**
1. **onDisconnect()の改善**: より確実な切断検知
2. **heartbeat間隔の最適化**: 無駄を排除した効率的な監視
3. **エラーハンドリング強化**: 接続失敗時の自動復旧

### **次点: ブラウザイベント強化**
1. **Page Visibility API の活用**: タブ切り替え・ページ非表示の検知
2. **Service Worker**: バックグラウンドでの状態管理
3. **navigator.sendBeacon()**: 確実な離脱通知

### **最後の手段: 補完的なAPIアプローチ**
- 定期的なheartbeat (但し最小限の頻度)
- サーバーサイドでのstaleユーザー検出
- クライアント側での冗長な監視

## 📐 **実装上の重要な制約**

### **✅ 必須要件**
- Firebase Realtime Databaseの`onDisconnect()`を主軸とする
- パフォーマンスへの影響を最小限に抑える
- ローカル開発環境では追加負荷をかけない
- 既存のゲームロジックを破壊しない

### **❌ 禁止事項**
- 過度なAPI呼び出し（15秒間隔など）
- FirestoreでのリアルタイムPresence管理
- 複雑な状態競合を生む重複実装
- 既存の正常動作部分の大幅変更

## 🔬 **デバッグ用のツール・ログ**

### **必須ログ実装**
```javascript
// presence.ts に追加すべきログ
console.log('[PRESENCE]', action, { roomId, uid, connected: isConnected });
console.log('[DISCONNECT]', onDisconnectResult, { path: meConnPath });
console.log('[HEARTBEAT]', success/failure, { timestamp, latency });
```

### **ブラウザDevTools確認項目**
```bash
# Network tab
- WebSocket接続の継続性
- Firebase RTDB接続状態
- API呼び出しのレスポンス時間

# Console tab
- Firebase接続エラー
- onDisconnect()の発火ログ
- ブラウザイベントの発火状況

# Application tab
- LocalStorage/SessionStorageの状態
- Service Worker の動作状況
```

## 📊 **成功の判定基準**

### **Primary Goals**
1. **ローカル環境**: ブラウザを閉じて5秒以内に参加者リストから削除
2. **Vercel環境**: ブラウザを閉じて10秒以内に参加者リストから削除
3. **タブ切り替え**: visibilitychange で即座に非アクティブ表示
4. **ネットワーク切断**: 30秒以内に自動的に削除

### **Performance Goals**
- API呼び出し: 最大1分間隔まで
- Firebase読み取り: 既存レベル維持
- JavaScript実行時間: 追加分は最大10ms/秒

## 🚀 **段階的実装プラン**

### **Step 1: 調査・分析 (1-2時間)**
- 現在の実装の完全な理解
- 問題の根本原因特定
- Firebase/Vercel設定の確認

### **Step 2: 最小限の修正 (30分-1時間)**
- onDisconnect()の改善
- エラーハンドリング追加
- ログ出力の強化

### **Step 3: 検証・テスト (30分)**
- ローカル環境でのテスト
- Vercel環境でのテスト
- 各種ブラウザでの動作確認

### **Step 4: ドキュメント作成 (15分)**
- 修正内容の記録
- 今後のメンテナンス指針
- 再発防止策の文書化

## ⚠️ **重要な注意事項**

1. **既存機能を壊さない**: ゲーム本体のロジックには影響しない
2. **パフォーマンス最優先**: 無駄なリクエストは絶対に避ける
3. **Firebase標準を尊重**: 独自実装より公式機能を活用
4. **ログを充実させる**: 問題再発時の早期発見のため
5. **段階的なアプローチ**: 一度に大きな変更をしない

## 📝 **完了時の成果物**

1. **修正されたコード**: presence.ts, useLeaveCleanup.ts 等
2. **動作確認結果**: 各環境・ブラウザでのテスト結果
3. **技術レポート**: 問題の原因と解決方法の詳細
4. **メンテナンス指針**: 今後の監視・改善ポイント

---

**この指示書に従って、最高品質の解決策を提供してください。急がば回れの精神で、確実で持続可能な修正を実装してください。**