# Drag Magnet Interaction Spec

## 背景
- `components/CentralCardBoard.tsx` で DndKit を利用したカードドラッグを採用中。
- 最新の実装で「楽観的な戻し反映 (optimistic return)」を導入済み。
- さらに “マグネット吸着” 演出を追加し、カードをスロットへ配置するときの視覚的な気持ちよさを向上させたい。

## 目的
1. カードが空きスロットに近づいた際に「引き寄せ」「ハイライト」「吸着」を感じられる Motion を付ける。
2. 既存の DndKit ドラッグ挙動や楽観的 UI 更新を崩さずに実装する。
3. GPU 非依存 (低スペック PC でも破綻しない)。
4. `prefers-reduced-motion` などアクセシビリティ設定を尊重。

## 推奨アプローチ
### 1. スロット候補のハイライト
- DndKit が提供する `over` 情報を利用し、現在の候補スロットに CSS クラス付与。
- CSS で `box-shadow` / `outline` / `background` を軽く変化 (transition 120ms)。
- チラつき防止のため、ハイライト切替に短い debounce (50〜120ms) を入れる。

### 2. 引き寄せ (吸着準備)
- ドラッグ対象の Transform を DndKit の値からさらに補正し、候補スロット中心へ補間。
- 仕組み: 候補の center と drag pointer の距離を計算し、一定半径 (`snapRadius`) 内なら補正率を上げる。
- Transform 補正は CSS ではなく JS で `style.transform` を加算する感じで (DndKit 値に加算)。  
  → `pointerOverContainer` 内で `customTransform` を足す or `DragOverlay` で wrap。
- 距離計算は `collisionDetection` の結果に付随する `over` の rect から算出。

### 3. ドロップ時の吸着
- `onDragEnd` で over slot があり、距離が `snapThreshold` 内→ snap 成功。
- Snap 成功時:
  - `transform` を `translate` でスロット中心に合わせつつ、CSS transition で 120ms ほどのバネ感 (cubic-bezier(0.2, 0.8, 0.4, 1))。
  - 標準の音や `playCardPlace()` と同期。
- Snap 失敗時 (遠い):
  - 既存ロジック通り `updatePendingState` / `notify` を呼ぶ。  
  - 視覚的には `transform` を元位置に戻す (既実装) + 可能なら軽微に左右揺れ (CSS `animation` で 2 回).

### 4. アニメーションの管理
- 基本は CSS / WAAPI の `transition` で十分。Web Animations API ならより柔らかさを付けやすい。
- GSAP など heavy なライブラリは導入しない (DndKit transform との衝突リスクあり)。
- `prefers-reduced-motion: reduce` の場合は transition duration を 0 もしくは 50ms 程度に短縮。

## 実装ステップ例
1. `magnet` 用ユーティリティ作成  
   - `computeMagnetTransform(overRect, pointerPosition, snapRadius)` → { dx, dy, strength }
   - strength (0.0〜1.0) を使って補正値を lerp。
2. DndKit `DragOverlay` or `Sortable` item で transform を調整。  
   - 例: `style={{ transform: baseTransform + magnetTransform }}` といった形で合成。
3. ハイライト用クラスを `WaitingArea` / `EmptyCard` に追加。
4. CSS へ transition, box-shadow, outline 効果を追加。
5. `onDragEnd` で snap 成功時には `notify` など既存処理 + optional sound (既に `playCardPlace` が併用中)。
6. `prefers-reduced-motion` をチェックし、オプションで `transition` を短くする。

## 注意点
- `optimisticReturningIds` や `pending` などのローカル状態と矛盾しないよう、UI 表示は必ず `placedIds`, `optimisticReturningSet` を参照。  
  → Snap 処理後も `removeCardFromProposal` 等の async 結果により UI が揺れないようにする。
- パフォーマンス: transform 補正計算は `pointermove` ごとに走るため軽量に (単純な距離計算 + lerp)。
- 将来的に `React Spring` などを導入する場合は DndKit transform と二重管理にならないようラップが必要。

## テスト項目
1. カード提出 (drag → slot) が従来通り高速にできる。
2. 吸着距離外で放した場合に元の位置へ即戻る (違和感なし)。
3. 吸着距離内なら “スッ” と吸い寄せ → ドロップで `playCardPlace` 音が鳴り、カードがスムーズに収まる。
4. 観戦モード / 再接続など全モードで UI が乱れない。
5. `prefers-reduced-motion` が `reduce` の場合、アニメーションが短縮/無効になる。

## 参考
- [DndKit ドキュメント](https://docs.dndkit.com/) の `collisionDetection` / `DragOverlay` カスタマイズ例。
- スプリング感は CSS の cubic-bezier や `transition-timing-function: steps(…)` などで軽量に調整可能。

