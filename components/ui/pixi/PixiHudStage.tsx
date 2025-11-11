"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Application, Container } from "@/lib/pixi/instance";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";

type LayerOptions = {
  zIndex?: number;
  interactive?: boolean;
};

type LayerRecord = {
  container: Container;
  refCount: number;
};

type BatchCapableRenderer = {
  batch?: {
    setMaxTextures?: (count: number) => void;
  };
};

interface PixiHudContextValue {
  app: Application | null;
  registerLayer: (name: string, options?: LayerOptions) => Container | null;
  unregisterLayer: (name: string) => void;
}

const PixiHudContext = createContext<PixiHudContextValue | undefined>(undefined);

export interface PixiHudStageProps {
  children?: React.ReactNode;
  zIndex?: number;
}

export function PixiHudStage({ children, zIndex = 20 }: PixiHudStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const layersRef = useRef<Map<string, LayerRecord>>(new Map());
  const [app, setApp] = useState<Application | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const safeDestroyContainer = useCallback((container: Container) => {
    if ((container as unknown as { destroyed?: boolean }).destroyed) {
      return;
    }
    try {
      container.destroy({ children: true });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[PixiHudStage] container destroy failed", error);
      }
    }
  }, []);

  const requestRestart = useCallback(() => {
    setRestartKey((value) => value + 1);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return () => {};
    }

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    const pixiApp = new Application();
    const layerStore = layersRef.current;
    let detachCanvasContextHandlers: (() => void) | null = null;

    const init = async () => {
      try {
        await pixiApp.init({
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          width: host.clientWidth || window.innerWidth,
          height: host.clientHeight || window.innerHeight,
          preference: 'webgl',
          hello: false, // コンソールログ削減
        });
      } catch (error) {
        console.error("[PixiHudStage] init failed", error);
        pixiApp.destroy(true);
        return;
      }

      if (disposed) {
        pixiApp.destroy(true);
        return;
      }

      appRef.current = pixiApp;
      // sortableChildren はレイヤー追加時に動的に有効化（デフォルト無効で軽量化）
      pixiApp.stage.sortableChildren = false;
      pixiApp.renderer.events.cursorStyles.default = "default";

      // バッチレンダリング最適化
      const batchController =
        (pixiApp.renderer as typeof pixiApp.renderer & BatchCapableRenderer).batch;
      if (batchController && typeof batchController.setMaxTextures === "function") {
        try {
          batchController.setMaxTextures(16); // デフォルト8から倍増
        } catch (error) {
          console.warn("[PixiHudStage] batch.setMaxTextures not available", error);
        }
      }

      host.innerHTML = "";
      host.appendChild(pixiApp.canvas);
      Object.assign(pixiApp.canvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      });

      const canvas = pixiApp.canvas;
      const handleContextLost = (event: Event) => {
        event.preventDefault?.();
        traceAction("pixi.hud.contextLost");
        if (!disposed) {
          requestRestart();
        }
      };
      const handleContextRestored = () => {
        traceAction("pixi.hud.contextRestored");
      };
      canvas.addEventListener("webglcontextlost", handleContextLost as EventListener, false);
      canvas.addEventListener(
        "webglcontextrestored",
        handleContextRestored as EventListener,
        false
      );
      detachCanvasContextHandlers = () => {
        canvas.removeEventListener("webglcontextlost", handleContextLost as EventListener, false);
        canvas.removeEventListener(
          "webglcontextrestored",
          handleContextRestored as EventListener,
          false
        );
      };

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          pixiApp.renderer.resize(width, height);
        }
      });
      resizeObserver.observe(host);

      setApp(pixiApp);

      // GPUウォームアップ（フラグON時のみ、初期化直後に空描画）
      if (process.env.NEXT_PUBLIC_PERF_WARMUP === "1") {
        try {
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              try {
                pixiApp.renderer.render(pixiApp.stage);
                setMetric("perf", "warmup.pixi", 1);
                traceAction("warmup.pixi");
              } catch (e) {
                console.warn("[PixiHudStage] warmup render failed", e);
                const err = e instanceof Error ? e : new Error(String(e));
                traceError("warmup.pixi", err);
              }
            })
          );
        } catch (e) {
          console.warn("[PixiHudStage] warmup scheduling failed", e);
        }
      }
    };

    init();

    return () => {
      disposed = true;
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (detachCanvasContextHandlers) {
        detachCanvasContextHandlers();
        detachCanvasContextHandlers = null;
      }
      layerStore.forEach(({ container }) => {
        safeDestroyContainer(container);
      });
      layerStore.clear();
      setApp(null);

      if (appRef.current) {
        try {
          appRef.current.destroy(true);
        } catch {
          // ignore
        }
        appRef.current = null;
      }
    };
  }, [requestRestart, restartKey, safeDestroyContainer]);

  const registerLayer = useCallback((name: string, options?: LayerOptions) => {
    const currentApp = appRef.current;
    if (!currentApp) return null;

    const store = layersRef.current;
    const existing = store.get(name);
    if (existing) {
      existing.refCount += 1;
      if (options?.zIndex !== undefined) {
        existing.container.zIndex = options.zIndex;
        currentApp.stage.sortChildren();
      }
      if (options?.interactive) {
        existing.container.eventMode = "dynamic";
        // Canvas全体のpointerEventsは"none"のまま（DOM要素のイベントをブロックしない）
      }
      return existing.container;
    }

    const container = new Container();
    container.sortableChildren = true;
    container.zIndex = options?.zIndex ?? 0;
    container.label = name;
    if (options?.interactive) {
      container.eventMode = "dynamic";
      // Canvas全体のpointerEventsは"none"のまま（DOM要素のイベントをブロックしない）
    } else {
      container.eventMode = "none";
    }

    currentApp.stage.addChild(container);

    // レイヤー数が増えた場合のみ sortableChildren を有効化
    if (currentApp.stage.children.length > 2) {
      currentApp.stage.sortableChildren = true;
    }
    currentApp.stage.sortChildren();
    store.set(name, { container, refCount: 1 });
    return container;
  }, []);

  const unregisterLayer = useCallback((name: string) => {
    const currentApp = appRef.current;
    if (!currentApp) return;

    const store = layersRef.current;
    const record = store.get(name);
    if (!record) return;

    record.refCount -= 1;
    if (record.refCount > 0) return;

    currentApp.stage.removeChild(record.container);
    safeDestroyContainer(record.container);
    store.delete(name);

    // Canvas全体のpointerEventsは常に"none"のまま
  }, [safeDestroyContainer]);

  const contextValue = useMemo<PixiHudContextValue>(
    () => ({
      app,
      registerLayer,
      unregisterLayer,
    }),
    [app, registerLayer, unregisterLayer]
  );

  return (
    <PixiHudContext.Provider value={contextValue}>
      {children}
      <div
        ref={hostRef}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          zIndex,
          pointerEvents: "none",
        }}
      />
    </PixiHudContext.Provider>
  );
}

export function usePixiHud(): PixiHudContextValue {
  const ctx = useContext(PixiHudContext);
  if (!ctx) {
    throw new Error("usePixiHud must be used within a PixiHudStage");
  }
  return ctx;
}

export function usePixiHudLayer(name: string, options?: LayerOptions) {
  const { app, registerLayer, unregisterLayer } = usePixiHud();
  const [container, setContainer] = useState<Container | null>(null);
  const optionsKey = JSON.stringify(options ?? {});

  useEffect(() => {
    if (!app) {
      setContainer(null);
      return () => {};
    }
    const layer = registerLayer(name, options);
    setContainer(layer);
    return () => {
      unregisterLayer(name);
      setContainer(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, optionsKey, registerLayer, unregisterLayer, app]);

  return container;
}
