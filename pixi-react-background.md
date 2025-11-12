
# Pixi.js v8 Background Architecture for Next.js 14 (React + Chakra UI)

**目的**  
- DOM 側（React + Chakra UI）は HUD/フォームのみ。  
- 背景は Pixi.js v8（WebGL）だけで描画。  
- WebGL コンテキストは **常に 1 個**（シングルトン `Application`）。  
- 画面遷移・visibilitychange・背景タイプの切替でも **Pixi アプリケーションは再生成しない**（シーン差し替えのみ）。  
- GSAP や手動 `requestAnimationFrame` のリークを確実に防止。  
- 必要なら OffscreenCanvas + Web Worker 化。

---

## TL;DR（推奨アーキテクチャ）
- **Pixi.Application を 1 度だけ初期化**し、`app.canvas` を DOM 最下層に配置（HUD は DOM 上位）。
- 背景タイプ変更は **`app.stage` 直下のコンテナ差し替え**で実現。`destroy({ children:true, texture:true, baseTexture:true })` 等で確実にクリーンアップ。
- `visibilitychange` で `app.stop()/app.start()`、`resize` で `app.renderer.resize()`。
- WebGL **context lost** に備え `webglcontextlost`（`preventDefault()`）/`webglcontextrestored` をハンドリング。
- 重い場合は **OffscreenCanvas + Worker** に分離（Safari 等ではフォールバック）。

---

## 参考ファイル構成（例）
```
src/
  lib/pixi/
    PixiBackground.ts            # シングルトン管理（attach/detach/swapScene）
    scenes/
      simple.ts                  # createSimpleScene()
      dq.ts                      # createDQScene()
      inferno.ts                 # createInfernoScene()
  app/
    layout.tsx                   # 背景コンテナを配置（App Router）
    components/
      BackgroundCanvasHost.tsx   # canvas を差し込むだけのコンポーネント
      HudRoot.tsx                # HUD（Chakra UI）
```

---

## Pixi シングルトン管理（TypeScript）

```ts
// src/lib/pixi/PixiBackground.ts
"use client";

import { Application, Container } from "pixi.js";

type SceneHandle = {
  container: Container;
  cleanup?: () => void; // GSAP stop / ticker remove / RAF cancel など
};

class PixiBackground {
  private static _instance: PixiBackground | null = null;
  static get i(): PixiBackground {
    if (!this._instance) this._instance = new PixiBackground();
    return this._instance;
  }

  app: Application | null = null;
  private hostEl: HTMLElement | null = null;
  private currentScene: SceneHandle | null = null;
  private onResize = () => {
    if (!this.app) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.app.renderer.resize(w, h);
  };
  private onVisibility = () => {
    if (!this.app) return;
    if (document.hidden) this.app.stop();
    else this.app.start();
  };
  private onContextLost = (e: Event) => {
    e.preventDefault(); // ブラウザのデフォルト復旧を抑制し、Pixi に任せる
    console.warn("[PixiBackground] webglcontextlost");
  };
  private onContextRestored = () => {
    console.warn("[PixiBackground] webglcontextrestored");
    // 必要に応じてテクスチャ再ロードなど
  };

  /** 初期化（最初の一回だけ呼ばれる想定） */
  async init() {
    if (this.app) return;
    this.app = new Application();
    await this.app.init({
      background: "#000000",
      antialias: true,
      powerPreference: "high-performance",
      // Next.js で SSR を避けるため resizeTo は使わず明示 resize に寄せる派も可
      width: window.innerWidth,
      height: window.innerHeight,
    });

    // コンテキストロス対応
    this.app.canvas.addEventListener("webglcontextlost", this.onContextLost as EventListener);
    this.app.canvas.addEventListener("webglcontextrestored", this.onContextRestored as EventListener);

    // イベント
    window.addEventListener("resize", this.onResize, { passive: true });
    document.addEventListener("visibilitychange", this.onVisibility);

    this.app.start();
  }

  /** DOM に canvas を差し込む（複数回 attach/detach 可） */
  async attach(host: HTMLElement) {
    await this.init();
    if (!this.app) return;

    if (this.hostEl === host) return;
    // 既存ホストから取り外し
    if (this.hostEl && this.app.canvas.parentElement === this.hostEl) {
      this.hostEl.removeChild(this.app.canvas);
    }
    this.hostEl = host;
    this.hostEl.appendChild(this.app.canvas);
    this.onResize();
  }

  /** DOM から canvas を取り外す（アプリ自体は破棄しない） */
  detach(host: HTMLElement) {
    if (!this.app) return;
    if (this.hostEl === host && this.app.canvas.parentElement === host) {
      host.removeChild(this.app.canvas);
    }
    this.hostEl = null;
  }

  /** シーン差し替え（古いシーンは確実に掃除） */
  swapScene(next: SceneHandle) {
    if (!this.app) return;
    if (this.currentScene) {
      const { container, cleanup } = this.currentScene;
      cleanup?.();
      this.app.stage.removeChild(container);
      // テクスチャ等を完全破棄する場合
      container.destroy({ children: true, texture: true, baseTexture: true });
    }
    this.currentScene = next;
    this.app.stage.addChild(next.container);
  }

  /** 完全破棄（アプリを本当に終了するときだけ） */
  destroy() {
    if (!this.app) return;
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.app.canvas.removeEventListener("webglcontextlost", this.onContextLost as EventListener);
    this.app.canvas.removeEventListener("webglcontextrestored", this.onContextRestored as EventListener);
    this.currentScene?.cleanup?.();
    this.currentScene = null;
    this.app.destroy(true); // GPU リソースも開放
    this.app = null;
    this.hostEl = null;
  }
}

export const PixiBG = PixiBackground.i;
```

---

## 背景コンテナのホスト（Next.js App Router）

```tsx
// src/app/components/BackgroundCanvasHost.tsx
"use client";

import { useEffect, useRef } from "react";
import { PixiBG } from "@/lib/pixi/PixiBackground";

export default function BackgroundCanvasHost() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    PixiBG.attach(el);
    return () => {
      PixiBG.detach(el);
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,        // HUD より下
        pointerEvents: "none", // 背景はヒットさせない
      }}
    />
  );
}
```

`layout.tsx` などで最下層に `<BackgroundCanvasHost />` を 1 回だけ配置すれば、ルーティングしても Pixi が生き続けます。HUD は `z-index` を高くして重ねます。

---

## シーン実装（GSAP/RAF を必ず停止可能に）

```ts
// src/lib/pixi/scenes/simple.ts
import { Container, Graphics } from "pixi.js";
import { gsap } from "gsap";

export function createSimpleScene() {
  const container = new Container();
  const circle = new Graphics().circle(0, 0, 80).fill(0x4488ff);
  circle.position.set(200, 200);
  container.addChild(circle);

  // GSAP
  const tl = gsap.timeline({ repeat: -1, yoyo: true });
  tl.to(circle, { pixi: { x: 800 }, duration: 3 });

  // requestAnimationFrame を使う場合
  let rafId = 0;
  const tick = () => {
    // 何かの更新
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  const cleanup = () => {
    tl.kill();
    cancelAnimationFrame(rafId);
  };

  return { container, cleanup };
}
```

```ts
// src/lib/pixi/scenes/inferno.ts（例）
import { Container, ParticleContainer, Sprite, Texture } from "pixi.js";

export function createInfernoScene() {
  const container = new Container();
  const particles = new ParticleContainer(2000, { position: true, rotation: true, uvs: true });
  container.addChild(particles);

  // ... パーティクル初期化

  const cleanup = () => {
    // パーティクル独自のタイマーやイベントを停止
  };

  return { container, cleanup };
}
```

---

## 背景タイプ切替（例：Zustand/Redux/Context から呼び出し）

```ts
// どこかのコントローラ
import { PixiBG } from "@/lib/pixi/PixiBackground";
import { createSimpleScene } from "@/lib/pixi/scenes/simple";
import { createInfernoScene } from "@/lib/pixi/scenes/inferno";

export type BackgroundKind = "simple" | "inferno" | "dq";

export function setBackground(kind: BackgroundKind) {
  switch (kind) {
    case "simple":
      PixiBG.swapScene(createSimpleScene());
      break;
    case "inferno":
      PixiBG.swapScene(createInfernoScene());
      break;
    case "dq":
      // PixiBG.swapScene(createDQScene());
      break;
  }
}
```

---

## OffscreenCanvas + Worker（任意・重い背景向け）

**利点**: 背景レンダリングをワーカーに隔離 → メインスレッド（React/Chakra）が滑らか。  
**注意**: DOM 非依存で実装（ポインタイベントを転送）、Safari ではフォールバック。

**メインスレッド**
```ts
// src/lib/pixi/workerBridge.ts
let worker: Worker | null = null;

export function bootWorker(canvasEl: HTMLCanvasElement) {
  if (typeof (canvasEl as any).transferControlToOffscreen !== "function") return null;
  worker = new Worker(new URL("./pixi.worker.ts", import.meta.url), { type: "module" });
  const offscreen = (canvasEl as any).transferControlToOffscreen();
  worker.postMessage({ type: "init", canvas: offscreen, width: innerWidth, height: innerHeight }, [offscreen]);
  addEventListener("resize", () => worker?.postMessage({ type: "resize", width: innerWidth, height: innerHeight }));
  document.addEventListener("visibilitychange", () => worker?.postMessage({ type: document.hidden ? "pause" : "resume" }));
  return worker;
}

export function setWorkerBackground(kind: string) {
  worker?.postMessage({ type: "setBackground", kind });
}

export function stopWorker() {
  worker?.terminate();
  worker = null;
}
```

**Worker 側**
```ts
// src/lib/pixi/pixi.worker.ts
import { Application, Container, DOMAdapter, WebWorkerAdapter } from "pixi.js";

DOMAdapter.set(WebWorkerAdapter);

let app: Application;
let current: Container | null = null;

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type === "init") {
    app = new Application();
    await app.init({ canvas: msg.canvas, width: msg.width, height: msg.height, background: "#000" });
    app.start();
  } else if (msg.type === "resize") {
    app?.renderer.resize(msg.width, msg.height);
  } else if (msg.type === "pause") {
    app?.stop();
  } else if (msg.type === "resume") {
    app?.start();
  } else if (msg.type === "setBackground") {
    // current を破棄して新しい Container を追加（メインスレッド版と同様）
  }
};
```

> Worker 方式でも **「シーン差し替え＋確実な cleanup」** という原則は同じ。  
> Safari など OffscreenCanvas 非対応の場合は **シングルトン本体**（メインスレッド）に自動フォールバック。

---

## リーク防止チェックリスト
- シーン切替時に **GSAP Timeline/Tween を kill**（`timeline.kill()` / `gsap.killTweensOf(target)`）。
- `requestAnimationFrame` の **ID を保持して cancel**。
- `app.ticker.add(fn)` を使ったら **`remove(fn)`** で解除。
- イベントリスナを **removeEventListener** で外す。
- コンテナ破棄時は必要に応じて  
  `container.destroy({ children:true, texture:true, baseTexture:true })` を使用。
- 大量テクスチャは **再利用か明示破棄**を決めて運用（プロファイラで VRAM を確認）。

---

## WebGL コンテキストロス対策
```ts
app.canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  // 背景を一時停止・ユーザーに軽い通知等
});
app.canvas.addEventListener("webglcontextrestored", () => {
  // 必要ならテクスチャ再ロードやシーン再構築
});
```
- 背景が真っ黒になっても **HUD は DOM のまま生存**。最悪は背景のみ再初期化すれば良い。  
- どうしても復旧できない場合の **静的フォールバック**（CSS グラデ/静止画）も用意しておくと堅牢。

---

## 共有コンテキスト vs 分離
- **共有（UI も WebGL 上で描く）**: ブレンドやフィルタで表現力は高いが、UI 実装・アクセシビリティ・保守が重い。  
- **分離（本案）**: Pixi は背景専用、UI は DOM/Chakra。開発速度・可用性・可観測性が高い。  
→ 本要件なら **分離一択**。

---

## 運用チェックリスト（本番）
- `Application` は **1 つだけ**。アプリのライフタイムと同一にする。
- 背景タイプ切替は **コンテナ差し替え + cleanup**。
- `visibilitychange`/`resize`/`contextlost` を監視。
- Dev 環境の HMR でも **二重初期化されない**ようにガード（`if (!app) await init()`）。
- パフォーマンステスト（60fps/高解像度・複数タブ）と VRAM 監視。
- Safari/古い端末向けの **フォールバック**（Worker 非対応時）。

---

以上のパターンをそのままベースにすれば、**「WebGL は 1 コンテキスト」「HUD は DOM で安全」**を両立しつつ、重い背景アニメも本番耐性のある実装にできます。
