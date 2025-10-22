据え置き計画ハンドオフ（Service-Online-Experience）
このドキュメントは、「序の紋章 III（オンライン版）」の“据え置き感”をさらに高めつつ、無停止・無強制退出を実現するための設計・運用・実装手順を次担当へ引き継ぐものです。

非交渉事項（原則）

RTDB を唯一のプレゼンス権威にする（Firestore lastSeen は復活させない）。
ゲーム進行ロジック・同期ロジックは変更せず、演出層・更新制御・計測で改善する。
すべての新機能はフラグでON/OFF可能（既定はOFF）。即時ロールバックできる粒度で実装。
変更はメトリクス（HUD/ログ）で必ず計測し、しきい値を越えたら自動/手動でキルスイッチ。
現状の基盤（要点）

PWA自動更新: app/ServiceWorkerRegistration.tsx で待機SWを applyServiceWorkerUpdate() 経由で自動適用。前面時はバッジ、背面化時は自動リロード。
バージョン整合: ルームDocの requiredSwVersion と APP_VERSION を参照、HUDで可視化。version mismatch 検知時の強制退出は暫定抑制。
プレゼンス: 心拍20s、PRESENCE_STALE_MS=120s に延長。瞬断・復帰で観戦落ちしづらい。
UI最適化: DragonQuestParty の差分レンダーと HUD メトリクス（renderMs/players/count）。
演出: showtime 実行メトリクス（lastScenario/lastDurationMs）を可視化。
メトリクスHUD: .env で NEXT_PUBLIC_DEBUG_METRICS=1 で左下に表示。
目標

100%自動更新（手動更新頼みをゼロへ）
version mismatch 起因の強制退出ゼロ（進行中は絶対に蹴らない）
フレーム予算内（p95 16ms デスクトップ / 22ms モバイル）維持
入力→視覚反応 p95 ≤ 80ms、復帰→演出再開 ≤ 120ms、復帰→初音 ≤ 150ms
フラグと環境変数

NEXT_PUBLIC_DEBUG_METRICS=1 HUD表示（本番では既定0）
NEXT_PUBLIC_ENABLE_PWA=1 PWA有効
NEXT_PUBLIC_PRESENCE_STALE_MS 既定120000（必要に応じて環境別 override）
互換導入用フラグ（追加予定）
NEXT_PUBLIC_FEATURE_SAFE_UPDATE=0/1（進行中は更新保留→境界で自動適用）
NEXT_PUBLIC_FEATURE_DPR_SCALER=0/1（動的DPRスケーリング）
NEXT_PUBLIC_FEATURE_POST_TASK=0/1（低優先タスク化）
NEXT_PUBLIC_FEATURE_BG_WORKER=0/1（背景OffscreenCanvas/Worker、PoC時のみ）
実装方針（段階導入）

安全なスケジューリング最適化（低リスク・高効果）
非クリティカル処理（プリフェッチ・ログ送信・軽い計算）を scheduler.postTask / requestIdleCallback に移動。
長い処理ループ内で navigator.scheduling.isInputPending?.() を挟み、入力待ちなら早期脱出して次フレームへ。
Long Task 検知を追加（PerformanceObserver({ type: "longtask" })）→ HUDに件数/直近時間を表示、閾値超でキルスイッチ。
Pixi のフレーム予算管理（見た目を崩さず描画負荷を吸収）
動的DPRスケーリング: p95フレーム > 22ms が続いたら renderer.resolution を段階的に 0.25 ずつ下げ、回復後は戻す。フラグ FEATURE_DPR_SCALER。
バッチ/キャッシュ徹底: 常時流れる粒子は ParticleContainer、静止レイヤーは cacheAsBitmap。重いブラーは事前レンダ RenderTexture を使用。
遷移最適化（白画面削減）
SW Navigation Preload を有効化、stale-while-revalidate のチューニング。
View Transitions API 対応ブラウザでページ遷移の切替フレームを滑らかに（既存 TransitionProvider 併用）。
OffscreenCanvas + Worker（背景限定、必要時だけ）
対応ブラウザで Pixi 背景のみ Worker 分離（イベントは低頻度のトリガのみ送信）。
未対応は自動フォールバック。PoC後に段階導入。常にフラグOFFへ即戻せる構成。
無停止更新（強制退出ゼロ）デザイン

進行中は適用保留: versionMismatch 検知時、ただちに観戦落ちにせず「猶予モード」へ（右上に小さな「背景で更新待機中」バナーを表示、入力は継続可能）。
自動適用トリガ拡充:
visibilitychange(hidden)（既存）
ルーム状態が waiting / ラウンド境界 / リザルトになった瞬間
一定アイドル（例: 30s 入力なし）
互換層（feature flags）を併用し、破壊的変更は flags 既定ON → 全員が新SWへ上がったことを presence/swVersion 分布で観測 → 次デプロイで古い経路を削除。
サーバ側補助（オプション）:
Functions が presence/swVersion 分布を見て、部屋単位で updatePhase を waiting 時に done へ。進行中は保留。
コード接点（変更すべき箇所の目印）

PWA自動更新制御: app/ServiceWorkerRegistration.tsx

追加トリガ: waiting/境界/アイドル30s で applyServiceWorkerUpdate()
既存の visibilitychange(hidden) は維持
バージョン猶予モード: app/rooms/[roomId]/page.tsx

現在の versionMismatch → forcedExit を「猶予モード」へ変更
小さなバナー表示（通知 or ヘッダUI）＋キルスイッチ
境界で自動適用へ遷移
Pixi 背景: lib/pixi/dragonQuestBackground.ts, components/ui/ThreeBackground.tsx

動的DPR、cacheAsBitmap、ParticleContainer の適用
将来: OffscreenCanvas PoC（feature flag でON）
スケジューリング: 既存のプリフェッチ箇所（app/rooms/[roomId]/page.tsx の PREFETCH_COMPONENT_LOADERS）を scheduler.postTask / requestIdleCallback へ移行

メトリクス強化（すでに多く実装済み）

app: appVersion, requiredSwVersion, versionMismatch
forcedExit: versionMismatch, gameInProgress
ui: dragonQuestPartyRenderMs, RenderCount
showtime: lastScenario, lastDurationMs, actionsExecuted
presence: heartbeat.ok/fail
運用・検証

カナリー: 開発・検証ルーム限定で FEATURE_SAFE_UPDATE=1 を有効化。forcedExit.* が 0 を維持できるか検証。
E2E 追加（Playwright）:
3ブラウザ（前面/背面/放置）起動→デプロイ→全員が途切れず進行、境界で自動更新されることを確認
バージョン混在時、進行中に猶予モード継続→待機で自動適用→再開
受け入れ基準:
forcedExit.* = 0（update関連）
app.versionMismatch = 0（境界、または背面化で解消）
p95フレームタイム: デスクトップ ≤ 16ms / モバイル ≤ 22ms
入力→視覚反応 p95 ≤ 80ms、復帰→演出再開 ≤ 120ms、復帰→初音 ≤ 150ms
リスクと回避策

自動適用ループ: controllerchange→reload が連続発生したらHUDカウンタ閾値超で FEATURE_SAFE_UPDATE を自動OFF。
モバイルDPR過剰低下: 最低解像度を 1.0 に制限、一定時間内に閾値を満たせば自動で戻す。
Worker/OffscreenCanvas: 常にフラグOFF運用。PoC以外で既定ONにしない。
引き継ぎメモ

変更は必ずフラグ化（既定OFF）、メトリクスとE2Eを先に用意。小さく入れて、悪化時は即OFF→原因特定→再投入。
既存の“据え置き感”はすでに高水準。性能が十分なら、次はコンテンツ（演出/UX）へ投資してKPIを伸ばすほうが費用対効果が高い。
ドキュメント更新: 本書を AGENTS.md に統合する際は「非交渉事項」「フラグ一覧」「受け入れ基準」「ロールバック手順」を必ず残す。
以上。必要に応じて、具体的なパッチ雛形（DPRスケーラ／猶予モードのUI／長タスク監視コード）も別紙で提供可能です。