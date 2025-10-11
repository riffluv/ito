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
import { Application, Container } from "pixi.js";

type LayerOptions = {
  zIndex?: number;
  interactive?: boolean;
};

type LayerRecord = {
  container: Container;
  refCount: number;
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

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    const host = hostRef.current;
    const pixiApp = new Application();

    const init = async () => {
      try {
        await pixiApp.init({
          backgroundAlpha: 0,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          width: host.clientWidth || window.innerWidth,
          height: host.clientHeight || window.innerHeight,
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
      pixiApp.stage.sortableChildren = true;
      pixiApp.renderer.events.cursorStyles.default = "default";

      host.innerHTML = "";
      host.appendChild(pixiApp.canvas);
      Object.assign(pixiApp.canvas.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      });

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
    };

    init();

    return () => {
      disposed = true;
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      layersRef.current.forEach(({ container }) => {
        container.destroy({ children: true });
      });
      layersRef.current.clear();
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
  }, []);

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
        currentApp.canvas.style.pointerEvents = "auto";
      }
      return existing.container;
    }

    const container = new Container();
    container.sortableChildren = true;
    container.zIndex = options?.zIndex ?? 0;
    container.label = name;
    if (options?.interactive) {
      container.eventMode = "dynamic";
      currentApp.canvas.style.pointerEvents = "auto";
    } else {
      container.eventMode = "none";
    }

    currentApp.stage.addChild(container);
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
    record.container.destroy({ children: true });
    store.delete(name);

    if (store.size === 0) {
      currentApp.canvas.style.pointerEvents = "none";
    }
  }, []);

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
      return;
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

