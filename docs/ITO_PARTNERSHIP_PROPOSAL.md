# Ito ブラウザ版連携提案

## 1. プロジェクト概要
- Next.js 14 App Router + TypeScript で構築したブラウザ向け協力推理ゲーム。Pixi.js / GSAP によるカード UI と、Chakra UI を組み合わせたレトロ調HUDを備える。
- Firestore + RTDB + Auth でプレイヤー/観戦者の状態と Presence を管理し、XState ベースの `roomMachine` で進行と UI を制御する。
- Safe Update/SW + telemetry によって、「旧バージョンのキャッシュでゲームが破綻する」リスクを極力排除した PWA 運用を実現。

## 2. 技術スタック・実装範囲（すべて自前／対応済）
- **フロントエンド**：Next.js + React Server Component の App Router、Pixi/GSAP で描画。SafeUpdateBanner/SafeUpdateRecovery を含む SW 連動 UI。
- **状態管理**：XState による `roomMachine`・`SpectatorController`・Safe Update FSM で、マルチプレイ進行・観戦・強制退出のロジックを厳密に定義。
- **リアルタイムインフラ**：Firestore + RTDB + Auth + Cloud Functions を併用し、ホスト権限・参加/離脱・Presence/ユーザー管理を整備。
- **安全運用**：Service Worker 更新チェック、強制リロード、Safe Update telemetry（`logSafeUpdateTelemetry`）でバージョン差異/HTTP 失敗を収集。`traceAction/traceError` で運用時の復旧ポイントを記録。
- **UI/UX**：Host/Spectator の説明、Safe Update バナー、更新オーバーレイ、エラーページ上からの復旧案内を含む設計。

## 3. 運用面のアドバンテージ
- 最新バージョン待機中でも破綻しない「自動更新＋Safe Update Recovery」回路を構築済み。URL 直打ちでも SW 更新が走るため、ユーザーはブラウザ更新を意識しなくてよい。
- telemetry により `appVersion`, `requiredSwVersion`, HTTP status を記録できるので、ネットワークエラー／バージョン不整合の再現なしで原因追跡が可能。
- ハードリロード無しで最新化できるが、それでも失敗した場合はエラー画面から「今すぐ更新」「ハードリロード」ボタンで復帰。ログ／trace 付きで SaaS 運用が可能。
- Safe Update 状態から `reset()` を呼ぶフローを入れ、重大なエラー画面を通過せず自然に最新版へ遷移させる設計。

## 4. コスト換算（国内中小スタジオに外部委託した場合の想定）
- 設計・Safe Update/Service Worker：2～3人月 × ¥120,000 = ¥240万～¥360万  
- フロントエンド開発（Next.js + Pixi/GSAP + UI）：3～4人月 × ¥120,000 = ¥360万～¥480万  
- リアルタイム + Firebase (Firestore/RTDB/Auth)：2～3人月 × ¥120,000 = ¥240万～¥360万  
- QA・テスト・運用設計：1.5～2人月 × ¥120,000 = ¥180万～¥240万  
- Safe Update telemetry/運用・SW耐障害設計：1～2人月 × ¥140,000 = ¥140万～¥280万  
→ **合計：約1,160万～1,720万円**（個人開発で同等の成果を出すのは珍しく、専門チームに委託すると高い単価になる）。

## 5. 実績 & 価値訴求
- 4人プレイで「爆笑しながらプレイできる」体験を検証済み。観戦・再接続・ホスト代行など、ito 的な協力推理に必要なフローを網羅。
- 現行コードは PWA/Safe Update 付きで URL 直打ちでも最新化・更新 UI が表示されるので、ito 本編の世界観をブラウザ拡張する素材としてそのまま利用可能。
- telemetry/trace を併用することで運用中のバージョン差異・エラーもログに残せるため、アークライト側での監視工数を抑えられる。

## 6. 次のステップ（提案）
1. 本資料＋実プレイで「ito + この UI の融合」を説明。アークライトとのパートナー契約（PoC 受託 or ライセンシング）に持ち込む。  
2. サンドボックス提供（デモ URL＋安全な更新ルート）で検証。  
3. 本体キャラクターをブラウザ版へ転載する際は、Safe Update/telemetry/リアルタイム同期が重要であることを強調し、技術的リードを提示。

必要であれば、上記をベースにした簡易資料（PDF/スライド）も併走して作れますので、希望があれば教えてください。
