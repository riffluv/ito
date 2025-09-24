# 🚨 CRITICAL BUG: ホスト自動移譲問題 - 完全解決指示書

## 📋 問題概要

**現象:** 非ホストユーザーが入退室を繰り返すと、現在のホストが勝手に他のユーザーに移譲される

**影響度:** 🔴 CRITICAL - 製品化を阻害する重大バグ

**再現率:** ~~約12.5%（8回に1回）~~ → **約80%（5回中4回）に悪化！！**

---

## 🔍 問題の詳細

### 再現手順
1. Chrome（通常）でルーム作成・ホストになる
2. Chrome（シークレット）で参加（2番目）
3. Brave で参加（3番目）
4. **Chrome シークレットが入退室を繰り返す**
5. → Chrome（本来のホスト）から Brave にホストが勝手に移譲される

### 確認済み事項
- ✅ Edge固有の問題ではない（Chrome シークレットでも同様）
- ✅ ブラウザ順序は関係ない（Brave が3番目でも同じ）
- ✅ サーバー側 `leaveRoomServer` は正常動作
- ✅ `GOOGLE_APPLICATION_CREDENTIALS` クリア済み

---

## 🔧 現在の環境設定

### 実行環境
```bash
# 環境変数をクリアしてから実行
set GOOGLE_APPLICATION_CREDENTIALS=
cd "C:\Users\hr-hm\Desktop\codex"
npm run dev
# → http://localhost:3000 で起動
```

### デバッグログ設定済み
以下のログが出力される：
- `[Server] Leave request:` - 退室API呼び出し
- `[Server] Players array check:` - プレイヤー配列の状態
- `[Server] Host exit check:` - ホスト退室判定
- `[Server] NON-HOST LEAVING` - 非ホスト退室時のログ
- `[HostCandidate] Host exists, no claim needed:` - クライアント側判定

---

## 🎯 重要な発見

### サーバー側は正常動作
```
[Server] NON-HOST LEAVING - no host change needed {
  currentHost: '66LT5TfKPpYpIrgf6bxaxSXfBlP2'  // Chrome
}
```
→ サーバーは正しく「非ホスト退室なのでホスト変更不要」と判定

### しかしホストが変わる
```
roomHostId: '66LT5TfKPpYpIrgf6bxaxSXfBlP2'  // Chrome
↓
roomHostId: '4jrGOFSKygYbS8ichOcZEKFhiKE3'  // Brave
```

### 推定原因
**クライアント側の `claim-host` API または `ensureHostAssignedServer` でホスト移譲が発生**

---

## 🔍 調査すべきポイント

### 1. クライアント側のホストclaim処理
- **ファイル:** `app/rooms/[roomId]/page.tsx`
- **関数:** `hostClaimCandidateId`, `attemptClaim`
- **確認点:** 非ホスト退室時に誰が `claim-host` API を呼んでいるか

### 2. サーバー側のensureHostAssignedServer
- **ファイル:** `lib/server/roomActions.ts`
- **関数:** `ensureHostAssignedServer`
- **確認点:** `shouldReassignHost` の判定ロジック

### 3. ネットワークログ確認
- Chrome DevTools → Network タブ
- シークレット退室時に `POST /api/rooms/*/claim-host` が呼ばれているか

---

## 💡 修正済み内容（効果なし）

### サーバー側修正
1. `room.deal.players` → `players` サブコレクション使用に変更
2. フォールバック処理で現在ホスト存在チェック追加
3. 詳細デバッグログ追加

### クライアント側修正
1. useEffect 依存配列から `players` 除去
2. 重複claim防止ロジック追加
3. ホスト存在時の候補者選択を無効化

**→ すべて効果なし。むしろ悪化！再現率が12.5% → 80%に上昇**

---

## 🚀 次の手順

### Phase 1: 犯人特定
1. **ネットワークログ確認**
   - シークレット退室時のAPI呼び出しを全て記録
   - `claim-host` が呼ばれているタイミングを特定

2. **ensureHostAssignedServer のログ追加**
   ```javascript
   console.log(`[ensureHostAssignedServer] Called:`, {
     roomId, uid, currentHost, shouldReassign
   });
   ```

### Phase 2: 根本修正
判明した犯人に応じて：
- **クライアント側が原因** → hostClaimCandidateId の計算ロジック修正
- **ensureHostAssignedServer が原因** → shouldReassignHost の条件修正
- **別のAPI が原因** → 該当処理の無効化

### Phase 3: 完全テスト
1. 複数ブラウザでの入退室テスト（最低10回）
2. 各種シナリオでの動作確認
3. **再現率 80% → 0% への改善確認** ⚠️ **極めて高確率で再現するため修正効果が分かりやすい**

---

## 📝 テスト用ログファイル

**使用方法:**
```bash
# 新しいルームでテスト実行
# 問題発生時のログを debug-test.md に記録済み
```

**最新ログの場所:** `C:\Users\hr-hm\Desktop\codex\debug-test.md`

---

## ⚠️ 重要な注意事項

1. **🚨 COMMIT禁止:** 現在の修正で問題が悪化(12.5% → 80%)しているため絶対にcommitしない
2. **Git管理:** `git stash` で現在の変更を保存してからクリーンな状態で作業推奨
3. **環境変数必須:** `GOOGLE_APPLICATION_CREDENTIALS` をクリアしてからテスト
4. **ポート確認:** npm run dev は 3000番ポートで実行
5. **ログ確認:** サーバーログとクライアントログの両方を確認
6. **デバッグログ除去:** 修正完了後は本番用にログを削除すること

---

## 🎯 成功条件

**以下の状況で Chrome のホストが維持されること:**
- Chrome（ホスト）+ Chrome シークレット（非ホスト）+ Brave（非ホスト）
- Chrome シークレットが入退室を10回以上繰り返す
- **期待結果:** Chrome のホスト権が一切変わらない

---

## 📞 引き継ぎ情報

- **前回担当者:** 複数の修正を試行したが根本解決に至らず
- **修正箇所:** サーバー・クライアント両方に広範囲な修正済み
- **残課題:** 真の原因（claim-host API呼び出し元）の特定と無力化

**この問題の解決により製品化が可能となります。優先度最高で対応をお願いします。** 🔥

---

## 🚨 重要な作業方針

### ユーザーへのデバッグログ依存を禁止 ⚠️
**❌ 絶対にやってはいけないこと:**
- ユーザーにコンソールログのコピー&ペーストを依頼する
- ユーザーに手動でテスト操作を繰り返し依頼する
- ユーザーにブラウザのネットワークタブ確認を依頼する

**✅ エージェントが自力でやるべきこと:**
- `BashOutput` ツールでサーバーログを直接取得
- 必要に応じて追加のログ出力機能を実装
- 自動化されたテスト手法で問題を検証
- ユーザー操作に依存しない調査方法を確立

**理由:** ユーザーは既に8時間もデバッグログをコピー&ペーストしており、これ以上の手動作業は不適切

### 製品化レベルの実装を要求 🏗️
**要求仕様:**
- **ベストプラクティス:** 一流企業の製品レベルのホスト管理システム
- **綺麗なコード:** 保守性・可読性・拡張性を備えた実装
- **シンプル設計:** 現在のような4つの処理が絡み合う複雑さを排除
- **単一責任:** ホスト管理の責務を明確化した専用モジュール
- **エラーハンドリング:** 予期しない状況での適切な処理
- **テスト容易性:** 単体テストが書きやすい設計

**参考アーキテクチャ:**
```typescript
// 理想的なホスト管理システムの例
class HostManager {
  private currentHostId: string | null = null;

  async assignHost(userId: string): Promise<boolean>
  async transferHost(fromUser: string, toUser: string): Promise<boolean>
  async handleUserLeave(userId: string): Promise<string | null>

  // シンプルで明確な責務分離
}
```

**現在の問題点を解決:**
- 複数箇所でのホスト管理ロジック分散を統一
- transaction競合を適切な排他制御で解決
- クライアント・サーバー間の責務を明確化