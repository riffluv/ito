# 勝利時の十字マーク演出が短くなった問題の修正指示

## 問題の状況

- **症状**: ゲーム勝利時、勝利BOXが登場する前の十字マーク（放射状ライン）の演出が非常に短い・しょぼい
- **ユーザーの期待**: 以前はもっと派手で、画面全体を貫くような光の演出があった
- **現在の状態**: 十字マークが画面中央付近で途切れており、画面の端まで届いていない

## 原因の特定

### 1. 履歴調査の結果

コミット `8a4f50c9` (高dpiでスクロール発生修正) で以下の変更が行われた：

**変更前**:
- `width: 200vw`
- `transformOrigin: "left center"`
- `position: fixed`（直接配置）

**変更後**:
- `width: 140vmax`
- `transformOrigin: "0% 50%"`
- `position: absolute`（親コンテナ内）
- 親に `overflow: hidden` が追加された

この変更により、ラインの長さが大幅に短縮された。

### 2. 試みた修正（まだ反映されていない可能性）

`components/ui/GameResultOverlay.tsx` の L785-789 付近で以下を変更：

```tsx
width="300vmax"
height="8px"
bg="linear-gradient(90deg, transparent, rgba(255,255,255,0.95) 20%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.6) 80%, transparent)"
transformOrigin="center center"
transform={`translate(-50%, -50%) rotate(${angle}deg)`}
```

しかし、**ブラウザで確認しても変化がない**。

## 修正タスク

### Phase 1: 現状確認

1. `components/ui/GameResultOverlay.tsx` の L765-796 付近を確認
2. 十字マーク（放射状ライン）のレンダリング部分のコードが以下になっているか確認：
   - `width: 300vmax` または `200vw` 以上
   - `transformOrigin: "center center"`
   - グラデーションが中央から両端に向かって透明になっている

3. もし上記になっていない場合は、まだ古いコード (`width: 140vmax`) の可能性がある

### Phase 2: ブラウザキャッシュ・ビルドキャッシュの確認

以下を順番に実行：

```bash
# 開発サーバーを停止
# Ctrl+C で停止

# Next.js のキャッシュをクリア
rm -rf .next

# ブラウザのハードリロード（開発サーバー再起動後）
# Ctrl+Shift+R または Cmd+Shift+R
```

### Phase 3: コードの完全な書き直し（推奨）

`components/ui/GameResultOverlay.tsx` の放射状ライン部分を以下のように**完全に置き換える**：

#### 置き換え対象（L765-796付近）

```tsx
{/* 放射状ライン（8本）*/}
<Box
  position="fixed"
  inset={0}
  overflow="hidden"
  pointerEvents="none"
  zIndex={9998}
>
  {[...Array(8)].map((_, i) => {
    // 45度刻みを少しずらしてAI的な演出にする
    const baseAngles = [0, 43, 88, 137, 178, 223, 271, 316];
    const angle = baseAngles[i];
    return (
      <Box
        key={i}
        ref={(el: HTMLDivElement | null) => {
          linesRef.current[i] = el;
        }}
        position="absolute"
        top="50%"
        left="50%"
        width="300vmax"  // ← ここが重要！
        height="8px"
        bg="linear-gradient(90deg, transparent, rgba(255,255,255,0.95) 20%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.6) 80%, transparent)"
        transformOrigin="center center"  // ← ここも重要！
        transform={`translate(-50%, -50%) rotate(${angle}deg)`}
        opacity={0}
        pointerEvents="none"
        style={{ contain: "layout paint" }}
      />
    );
  })}
</Box>
```

#### 重要ポイント

1. **`position: fixed`** ではなく **親Boxを `position: fixed`** にして、その中で **`position: absolute`** を使う
2. **親Boxに `overflow: hidden`** を設定することでスクロールバーを防ぐ
3. **`width: 300vmax`** で画面の対角線の3倍の長さを確保
4. **`transformOrigin: "center center"`** で中央から両方向に伸びる
5. **`transform={translate(-50%, -50%) rotate(${angle}deg)}`** で完全に中央配置

### Phase 4: アニメーションパラメータの調整

L412-461 付近のアニメーション設定も確認：

```tsx
// 【第1波】LEFT から爆発
scaleX: 1.8,  // 中央から両方向なので、この値でOK
duration: 0.92,

// 【第2波】RIGHT から爆発
scaleX: 1.8,
duration: 0.92,

// 【第3波】CENTER から爆発
scaleX: 2.1,  // 最も派手に
duration: 1.17,
```

**もし十分に派手でない場合**は、以下の値に変更：

```tsx
// より派手なバージョン
scaleX: 2.5,  // 第1波・第2波
duration: 1.2,

scaleX: 3.0,  // 第3波
duration: 1.5,
```

### Phase 5: デバッグ方法

ブラウザの開発者ツールで以下を確認：

1. **Elements タブ**で十字マークのDOM要素を探す
2. 実際の `width` が何になっているか確認（`300vmax` になっているべき）
3. `transform` が `translate(-50%, -50%) rotate(...)` になっているか確認
4. **Console タブ**でエラーが出ていないか確認

### Phase 6: 最終手段（元の仕様に戻す）

もし上記で解決しない場合、コミット `8a4f50c9` の直前の状態に戻す：

```bash
git show 8a4f50c9^:components/ui/GameResultOverlay.tsx > temp_old_version.tsx
```

このファイルの放射状ライン部分（L762-788付近）をコピーして、現在のファイルに適用する。

ただし、高DPI対応のため親コンテナの `overflow: hidden` は維持すること。

## 期待される結果

- 十字マークが画面の端から端まで届く
- 勝利BOXが登場する前に、0.9〜1.2秒ほど派手な光の演出が見える
- 3段階（LEFT → RIGHT → CENTER）で波状に広がる

## 補足情報

- ファイルパス: `components/ui/GameResultOverlay.tsx`
- 勝利時のアニメーション全体は L377-686 付近
- GSAP timeline で制御されている
- `prefers-reduced-motion` に対応している（L32, L118-129）

## 質問が必要な場合

- 「元の演出はどれくらいの時間表示されていたか？」→ おそらく1秒以上
- 「画面のどこまで届いていたか？」→ 画面の端まで完全に貫いていた
- 「何本のラインがあったか？」→ 8本（放射状）

以上、次のエージェントはこの指示書に従って修正を完了してください。
