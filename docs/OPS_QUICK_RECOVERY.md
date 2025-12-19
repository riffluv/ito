# 緊急オペ・クイックリカバリ手順

この1ページは「公開直後の緊急対応」用の最短手順です。詳細は `docs/OPERATIONS.md` を参照してください。

---

## 0) まずやること（2分）
1. 発生時刻 / ルームID / 端末・ブラウザ / 影響人数を記録  
2. DevTools Console で `dumpItoMetricsJson("incident")` を取得  
3. Network タブで失敗した API の status/response を保存

---

## 1) よくある緊急症状と即応

### A. 部屋作成/入室が 500/405
- **原因の典型**: 静的エクスポート配信（API が無効化）
- **即応**:
  1) Vercel Build 設定の `Framework Preset = Next.js` / `Output Directory = 空` を確認  
  2) `npm run build` のログで `Static Export` が出ていないか確認  
  3) 再デプロイ（prebuilt は使わない）  
  ※ 詳細は `docs/OPERATIONS.md` の「4.2 部屋作成が本番だけ 405/500」参照

### B. 観戦/参加の切替が壊れる・人数がズレる
- **原因の典型**: RTDB Presence が更新されていない / ENV が誤設定
- **即応**:
  1) `dumpItoMetricsJson` 内の `presence` / `participants` を確認  
  2) `NEXT_PUBLIC_FIREBASE_DATABASE_URL` と `NEXT_PUBLIC_FIREBASE_PROJECT_ID` を確認  
  3) `NEXT_PUBLIC_FIREBASE_USE_EMULATOR` が本番で有効になっていないか確認

### C. Safe Update が適用されない
- **原因の典型**: SW キャッシュ破損 / waiting 状態が固着
- **即応**:
  1) DevTools > Application > Clear Storage でサイトデータ削除  
  2) 再読み込み後に `safeUpdate` バナーが出るか確認  
  ※ 詳細は `docs/OPERATIONS.md` の Safe Update 手順参照

---

## 2) 共有テンプレ（Slack/Notion向け）
```
【発生時刻】YYYY/MM/DD HH:mm
【症状】(例) 部屋作成が 500 / 観戦復帰できない / Safe Update 固着
【ルームID】xxxxx
【端末/ブラウザ】iPhone Safari / Windows Chrome など
【再現手順】(簡潔に)
【dumpItoMetricsJson】(添付)
【Networkログ】(status/response)
```

---

## 3) 参考リンク
- `docs/OPERATIONS.md`
- `docs/DEBUG_METRICS.md`
