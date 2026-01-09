import { useEffect, useRef } from "react";
import { usePixiHudLayer } from "@/components/ui/pixi/PixiHudStage";
import { usePixiLayerLayout } from "@/components/ui/pixi/usePixiLayerLayout";
import PIXI from "@/lib/pixi/instance";
import { drawChatPanelBackground } from "@/lib/pixi/chatPanelBackground";

export function useChatPanelPixiBackground() {
  const chatRef = useRef<HTMLDivElement>(null);
  const pixiContainer = usePixiHudLayer("chat-panel", {
    zIndex: 15,
  });
  const pixiGraphicsRef = useRef<PIXI.Graphics | null>(null);

  useEffect(() => {
    const destroyGraphics = () => {
      if (pixiGraphicsRef.current) {
        if (pixiGraphicsRef.current.parent) {
          pixiGraphicsRef.current.parent.removeChild(pixiGraphicsRef.current);
        }
        pixiGraphicsRef.current.destroy({ children: true });
        pixiGraphicsRef.current = null;
      }
    };

    if (!pixiContainer) {
      destroyGraphics();
      return destroyGraphics;
    }

    const graphics = new PIXI.Graphics();
    graphics.zIndex = -10;
    pixiContainer.addChild(graphics);
    pixiGraphicsRef.current = graphics;

    return destroyGraphics;
  }, [pixiContainer]);

  usePixiLayerLayout(chatRef, pixiContainer, {
    disabled: !pixiContainer,
    onUpdate: (layout) => {
      const graphics = pixiGraphicsRef.current;
      if (!graphics || layout.width <= 0 || layout.height <= 0) {
        return;
      }

      graphics.clear();
      graphics.position.set(layout.x, layout.y);
      drawChatPanelBackground(PIXI, graphics, {
        width: layout.width,
        height: layout.height,
        dpr: layout.dpr,
      });
    },
  });

  return { chatRef };
}

