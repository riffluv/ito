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
import type { Renderer } from "pixi.js";

type LayerOptions = {
  zIndex?: number;
  interactive?: boolean;
};

type LayerRecord = {
  container: Container;
  refCount: number;
};

const PIXI_CONTEXT_EVENT = "ito:pixi-context";
const TEXTURE_UPLOAD_CHUNK = 6;

type PixiContextEventDetail = {
  source: "hud";
  status: "lost" | "restored" | "restarting";
};

const emitPixiContextEvent = (detail: PixiContextEventDetail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PIXI_CONTEXT_EVENT, { detail }));
};

type ManagedTextureRenderer = Renderer & {
  texture?: {
    managedTextures?: unknown[];
    bind?: (source: unknown, location?: number) => void;
  };
};

const uploadTexturesInChunks = (renderer: Renderer, chunkSize = TEXTURE_UPLOAD_CHUNK) =>
  new Promise<void>((resolve) => {
    const textureSystem = (renderer as ManagedTextureRenderer).texture;
    const managed = Array.isArray(textureSystem?.managedTextures)
      ? textureSystem.managedTextures ?? []
      : [];
    if (!managed.length) {
      resolve();
      return;
    }
    let index = 0;
    const total = managed.length;

    const uploadNext = () => {
      const end = Math.min(index + chunkSize, total);
      for (; index < end; index += 1) {
        const textureSource = managed[index];
        if (!textureSource) continue;
        try {
          textureSystem?.bind?.(textureSource, 0);
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.warn("[PixiHudStage] texture bind failed during recovery", error);
          }
        }
      }
      if (index < total) {
        if (typeof window !== "undefined") {
          window.requestAnimationFrame(uploadNext);
        } else {
          setTimeout(uploadNext, 16);
        }
      } else {
        resolve();
      }
    };

    uploadNext();
  });

type BatchCapableRenderer = {
  batch?: {
    setMaxTextures?: (count: number) => void;
  };
};

interface PixiHudContextValue {
  app: Application | null;
  registerLayer: (name: string, options?: LayerOptions) => Container | null;
  unregisterLayer: (name: string) => void;
  waitForRendererReady: () => Promise<boolean>;
  renderOnce: (reason?: string) => Promise<boolean>;
  waitForHudReady: () => Promise<Application | null>;
  hudRoot: Container | null;
  markBackgroundReady: () => void;
  holdBackground: () => (() => void) | undefined;
}

const PixiHudContext = createContext<PixiHudContextValue | undefined>(undefined);

export interface PixiHudStageProps {
  children?: React.ReactNode;
  zIndex?: number;
  /**
   * false の場合は Pixi Application を初期化せず、軽量なコンテキストだけを提供する。
   * ルーム外（ロビー等）の初回ロード負荷を避けたいときに利用する。
   */
  enabled?: boolean;
}

export function PixiHudStage({ children, zIndex = 20, enabled = true }: PixiHudStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const layersRef = useRef<Map<string, LayerRecord>>(new Map());
  const hudRootRef = useRef<Container | null>(null);
  const readyPromiseRef = useRef<{
    promise: Promise<Application | null>;
    resolve: (app: Application | null) => void;
  } | null>(null);
  const recoveringRef = useRef(false);
  const recoveryReleaseRef = useRef<(() => void) | null>(null);
  const [app, setApp] = useState<Application | null>(null);
  const [hudRoot, setHudRoot] = useState<Container | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const [backgroundReady, setBackgroundReady] = useState(true);
  const [backgroundHoldCount, setBackgroundHoldCount] = useState(0);
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
  const holdBackground = useCallback(() => {
    setBackgroundHoldCount((count) => count + 1);
    return () => {
      setBackgroundHoldCount((count) => Math.max(0, count - 1));
    };
  }, []);
  const markBackgroundReady = useCallback(() => {
    setBackgroundHoldCount(0);
    setBackgroundReady(true);
  }, []);

  const waitForHudReady = useCallback(() => {
    if (!enabled) {
      return Promise.resolve(null);
    }
    if (!readyPromiseRef.current) {
      let resolveFn: (app: Application | null) => void = () => {};
      const promise = new Promise<Application | null>((resolve) => {
        resolveFn = resolve;
      });
      readyPromiseRef.current = { promise, resolve: resolveFn };
    }
    // すでに app が存在すれば即解決
    if (appRef.current) {
      readyPromiseRef.current.resolve(appRef.current);
    }
    return readyPromiseRef.current.promise;
  }, [enabled]);

  const waitForRendererReady = useCallback(async () => {
    const pickGl = (r: Renderer | null | undefined) => {
      const candidate = r as unknown as {
        gl?: WebGLRenderingContext | WebGL2RenderingContext;
        context?: { gl?: WebGLRenderingContext | WebGL2RenderingContext };
        renderingContext?: { gl?: WebGLRenderingContext | WebGL2RenderingContext };
      } | null;
      return (
        candidate?.gl ||
        candidate?.context?.gl ||
        (candidate as { renderingContext?: { gl?: WebGLRenderingContext } })?.renderingContext?.gl ||
        null
      );
    };

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const renderer = appRef.current?.renderer as Renderer | undefined;
      const gl = pickGl(renderer);
      const lost = typeof gl?.isContextLost === "function" ? gl.isContextLost() : false;
      if (gl && !lost) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 16 * (attempt + 1)));
    }

    return false;
  }, []);

  const renderOnce = useCallback(
    async (reason?: string) => {
      const currentApp = appRef.current;
      if (!currentApp) return false;

      const ready = await waitForRendererReady();
      if (!ready) return false;

      return new Promise<boolean>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            try {
              currentApp.renderer.render(currentApp.stage);
              resolve(true);
            } catch (error) {
              if (process.env.NODE_ENV !== "production") {
                // eslint-disable-next-line no-console
                console.warn(
                  `[PixiHudStage] renderOnce${reason ? ` (${reason})` : ""} failed`,
                  error
                );
              }
              traceError("pixi.hud.renderOnceFailed", error);
              resolve(false);
            }
          });
        });
      });
    },
    [waitForRendererReady]
  );

  const pauseHud = useCallback(() => {
    const currentApp = appRef.current;
    if (currentApp) {
      currentApp.ticker.stop();
    }
  }, []);

  const resumeHud = useCallback(() => {
    const currentApp = appRef.current;
    if (currentApp) {
      currentApp.ticker.start();
    }
  }, []);

  const beginRecovery = useCallback(() => {
    if (recoveringRef.current) return;
    recoveringRef.current = true;
    pauseHud();
    if (!recoveryReleaseRef.current) {
      recoveryReleaseRef.current = holdBackground() ?? null;
    }
    emitPixiContextEvent({ source: "hud", status: "lost" });
  }, [holdBackground, pauseHud]);

  const endRecovery = useCallback(() => {
    if (!recoveringRef.current) return;
    recoveringRef.current = false;
    if (recoveryReleaseRef.current) {
      recoveryReleaseRef.current();
      recoveryReleaseRef.current = null;
    }
    resumeHud();
    emitPixiContextEvent({ source: "hud", status: "restored" });
  }, [resumeHud]);

  const attemptRendererRecovery = useCallback(async () => {
    const currentApp = appRef.current;
    if (!currentApp) return false;
    const renderer = currentApp.renderer as Renderer;
    if (typeof (renderer as unknown as { reset?: () => void }).reset !== "function") {
      return false;
    }
    try {
      (renderer as unknown as { reset: () => void }).reset();
    } catch (error) {
      traceError("pixi.hud.rendererResetFailed", error);
      return false;
    }
    try {
      await uploadTexturesInChunks(currentApp.renderer as unknown as Renderer);
    } catch (error) {
      traceError("pixi.hud.textureUploadFailed", error);
    }
    return true;
  }, []);

  const isFirstRestartRef = useRef(true);
  useEffect(() => {
    if (isFirstRestartRef.current) {
      isFirstRestartRef.current = false;
      return undefined;
    }
    const release = holdBackground();
    return () => {
      release?.();
    };
  }, [restartKey, holdBackground]);

  useEffect(() => {
    setBackgroundReady(backgroundHoldCount === 0);
  }, [backgroundHoldCount]);

  useEffect(() => {
    if (!enabled) {
      setApp(null);
      setHudRoot(null);
      if (readyPromiseRef.current) {
        readyPromiseRef.current.resolve(null);
      }
      return () => {};
    }
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
      // 稀に autoStart が抑止される環境（省電力モード等）への対策
      if (!pixiApp.ticker.started) {
        pixiApp.ticker.start();
      }

      const hudRoot = new Container();
      hudRoot.sortableChildren = true;
      hudRoot.label = "pixi-hud-root";
      hudRoot.eventMode = "none";
      hudRootRef.current = hudRoot;
      pixiApp.stage.addChild(hudRoot);
      setHudRoot(hudRoot);

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
        mixBlendMode: "normal",
      });

      const canvas = pixiApp.canvas;
      const handleContextLost = (event: Event) => {
        event.preventDefault?.();
        traceAction("pixi.hud.contextLost");
        if (disposed) return;
        beginRecovery();
      };
      const handleContextRestored = () => {
        traceAction("pixi.hud.contextRestored");
        if (disposed || !recoveringRef.current) {
          return;
        }
        const finalize = async () => {
          const recovered = await attemptRendererRecovery();
          if (recovered) {
            endRecovery();
          } else {
            emitPixiContextEvent({ source: "hud", status: "restarting" });
            requestRestart();
          }
        };
        void finalize();
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
      if (readyPromiseRef.current) {
        readyPromiseRef.current.resolve(pixiApp);
      } else {
        readyPromiseRef.current = {
          promise: Promise.resolve(pixiApp),
          resolve: () => {},
        };
      }
      if (recoveringRef.current) {
        endRecovery();
      }

      // GPUウォームアップ（全環境で必須、特にグラボなし端末で初回描画を保証）
      // void を削除し、await で完了を待つことで確実にGPUを準備する
      const warmupOk = await renderOnce("warmup.pixi");
      if (warmupOk) {
        setMetric("perf", "warmup.pixi", 1);
        traceAction("warmup.pixi");
      }

      // さらに確実にするため、もう1フレーム待つ（GPU処理の完全な完了を保証）
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });
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
      setHudRoot(null);
      if (hudRootRef.current) {
        safeDestroyContainer(hudRootRef.current);
        hudRootRef.current = null;
      }

      if (appRef.current) {
        try {
          appRef.current.destroy(true);
        } catch {
          // ignore
        }
        appRef.current = null;
      }
      if (host) {
        host.innerHTML = "";
      }
    };
  }, [
    attemptRendererRecovery,
    beginRecovery,
    endRecovery,
    requestRestart,
    restartKey,
    safeDestroyContainer,
    renderOnce,
    enabled,
  ]);

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

    const parent = hudRootRef.current ?? currentApp.stage;
    parent.addChild(container);

    // レイヤー数が増えた場合のみ sortableChildren を有効化
    if (parent.children.length > 2) {
      parent.sortableChildren = true;
    }
    parent.sortChildren();
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

    if (record.container.parent) {
      record.container.parent.removeChild(record.container);
    } else {
      currentApp.stage.removeChild(record.container);
    }
    safeDestroyContainer(record.container);
    store.delete(name);

    // Canvas全体のpointerEventsは常に"none"のまま
  }, [safeDestroyContainer]);

  const activeContextValue = useMemo<PixiHudContextValue>(
    () => ({
      app,
      registerLayer,
      unregisterLayer,
      hudRoot,
      markBackgroundReady,
      holdBackground,
      waitForRendererReady,
      renderOnce,
      waitForHudReady,
    }),
    [
      app,
      registerLayer,
      unregisterLayer,
      hudRoot,
      markBackgroundReady,
      holdBackground,
      waitForRendererReady,
      renderOnce,
      waitForHudReady,
    ]
  );

  const disabledContextValue = useMemo<PixiHudContextValue>(
    () => ({
      app: null,
      registerLayer: () => null,
      unregisterLayer: () => {},
      hudRoot: null,
      markBackgroundReady: () => {},
      holdBackground: () => undefined,
      waitForRendererReady: async () => false,
      renderOnce: async () => false,
      waitForHudReady: async () => null,
    }),
    []
  );

  const contextValue = enabled ? activeContextValue : disabledContextValue;

  return (
    <PixiHudContext.Provider value={contextValue}>
      {children}
      {enabled ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            width: "100vw",
            height: "100vh",
            zIndex,
            pointerEvents: "none",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 0,
              background:
                "radial-gradient(circle at 25% 25%, rgba(34,44,84,0.45), transparent 60%), linear-gradient(180deg, #05060a 0%, #080a12 60%, #05060a 100%)",
              transition: "opacity 280ms ease",
              opacity: backgroundReady ? 0 : 1,
              pointerEvents: "none",
            }}
          />
          <div
            ref={hostRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
        </div>
      ) : null}
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

export function usePixiHudContext(): PixiHudContextValue | undefined {
  return useContext(PixiHudContext);
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
