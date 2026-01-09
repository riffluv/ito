import { gsap } from "gsap";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  usePixiHudContext,
  usePixiHudLayer,
} from "@/components/ui/pixi/PixiHudStage";
import { usePixiLayerLayout } from "@/components/ui/pixi/usePixiLayerLayout";
import PIXI from "@/lib/pixi/instance";
import {
  createBattleRecordsAmbient,
  drawBattleRecordsBoard,
} from "@/lib/pixi/battleRecordsBackground";
import type { BattleRecordsAmbient } from "@/lib/pixi/battleRecordsAmbient";

type Params = {
  isOpen: boolean;
  failed?: boolean;
  boardRef: RefObject<HTMLElement>;
};

export function useMvpLedgerPixiBackground({ isOpen, failed, boardRef }: Params) {
  const pixiContainer = usePixiHudLayer("battle-records-board", {
    zIndex: 90,
  });
  const pixiHudContext = usePixiHudContext();
  const pixiGraphicsRef = useRef<PIXI.Graphics | null>(null);
  const ambientRef = useRef<BattleRecordsAmbient | null>(null);
  const gsapRenderCancelRef = useRef<(() => void) | null>(null);
  const [panelReady, setPanelReady] = useState(false);

  // Pixi コンテナが取れない場合やリセット時は即フォールバックを有効化
  useEffect(() => {
    if (!pixiContainer) {
      setPanelReady(false);
    }
  }, [pixiContainer]);

  // WebGL コンテキスト喪失時は一旦フォールバックさせる（再描画で復帰）
  useEffect(() => {
    const handlePixiContext = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.status === "lost" || detail?.status === "restarting") {
        setPanelReady(false);
      }
    };
    window.addEventListener("ito:pixi-context", handlePixiContext as EventListener);
    return () => {
      window.removeEventListener(
        "ito:pixi-context",
        handlePixiContext as EventListener
      );
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !pixiContainer) {
      if (pixiGraphicsRef.current) {
        if (pixiGraphicsRef.current.parent) {
          pixiGraphicsRef.current.parent.removeChild(pixiGraphicsRef.current);
        }
        pixiGraphicsRef.current.destroy({ children: true });
        pixiGraphicsRef.current = null;
      }
      if (ambientRef.current) {
        if (ambientRef.current.parent) {
          ambientRef.current.parent.removeChild(ambientRef.current);
        }
        ambientRef.current.destroy({ children: true });
        ambientRef.current = null;
      }
      if (gsapRenderCancelRef.current) {
        gsapRenderCancelRef.current();
        gsapRenderCancelRef.current = null;
      }
      setPanelReady(false);
      if (pixiHudContext?.renderOnce) {
        void pixiHudContext.renderOnce("mvpLedger:cleanup");
      }
      return undefined;
    }

    const graphics = new PIXI.Graphics();
    graphics.zIndex = -10;
    pixiContainer.addChild(graphics);
    pixiGraphicsRef.current = graphics;

    return () => {
      if (pixiGraphicsRef.current) {
        if (pixiGraphicsRef.current.parent) {
          pixiGraphicsRef.current.parent.removeChild(pixiGraphicsRef.current);
        }
        pixiGraphicsRef.current.destroy({ children: true });
        pixiGraphicsRef.current = null;
      }
      if (ambientRef.current) {
        if (ambientRef.current.parent) {
          ambientRef.current.parent.removeChild(ambientRef.current);
        }
        ambientRef.current.destroy({ children: true });
        ambientRef.current = null;
      }
      if (gsapRenderCancelRef.current) {
        gsapRenderCancelRef.current();
        gsapRenderCancelRef.current = null;
      }
      setPanelReady(false);
    };
  }, [isOpen, pixiContainer, pixiHudContext]);

  usePixiLayerLayout(boardRef, pixiContainer, {
    disabled: !isOpen || !pixiContainer,
    onUpdate: (layout) => {
      const graphics = pixiGraphicsRef.current;
      if (!graphics || layout.width <= 0 || layout.height <= 0) {
        setPanelReady(false);
        return;
      }

      const warmupAndReady = async () => {
        try {
          if (pixiHudContext?.waitForHudReady) {
            const app = await pixiHudContext.waitForHudReady();
            if (!app) {
              console.error("[MvpLedger] PixiHudStage initialization failed");
              setPanelReady(false);
              return;
            }
            if (app.ticker && !app.ticker.started) {
              app.ticker.start();
            }
            if (!gsapRenderCancelRef.current) {
              const renderWithGsap = () => {
                try {
                  app.renderer.render(app.stage);
                } catch {
                  // ignore
                }
              };
              gsap.ticker.add(renderWithGsap);
              gsapRenderCancelRef.current = () => gsap.ticker.remove(renderWithGsap);
            }
          }

          graphics.clear();
          graphics.position.set(layout.x, layout.y);
          drawBattleRecordsBoard(PIXI, graphics, {
            width: layout.width,
            height: layout.height,
            dpr: layout.dpr,
            failed,
          });

          if (!ambientRef.current && pixiContainer) {
            const ambient = createBattleRecordsAmbient({
              width: layout.width,
              height: layout.height,
              failed,
            });
            ambient.position.set(layout.x, layout.y);
            ambient.zIndex = -8;
            pixiContainer.addChild(ambient);
            ambientRef.current = ambient;
          } else if (ambientRef.current) {
            ambientRef.current.resize(layout.width, layout.height);
            ambientRef.current.position.set(layout.x, layout.y);
          }

          if (pixiHudContext?.renderOnce) {
            await pixiHudContext.renderOnce("mvpLedger:draw");
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  resolve();
                });
              });
            });
          }

          ambientRef.current?.initialize?.();
          setPanelReady(true);
        } catch (error) {
          console.error(
            "[MvpLedger] failed to draw Pixi battle records panel",
            error
          );
          setPanelReady(false);
        }
      };

      warmupAndReady().catch((error) => {
        console.error("[MvpLedger] warmup failed", error);
        setPanelReady(false);
      });
    },
  });

  const fallbackPanel = !panelReady;

  return { fallbackPanel };
}
