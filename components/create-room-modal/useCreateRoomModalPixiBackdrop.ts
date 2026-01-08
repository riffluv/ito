"use client";

import { usePixiHudLayer } from "@/components/ui/pixi/PixiHudStage";
import { usePixiLayerLayout } from "@/components/ui/pixi/usePixiLayerLayout";
import PIXI from "@/lib/pixi/instance";
import { drawSettingsModalBackground } from "@/lib/pixi/settingsModalBackground";
import React from "react";

const noopCleanup = () => {};

export function useCreateRoomModalPixiBackdrop(params: { isOpen: boolean }) {
  const { isOpen } = params;
  const modalRef = React.useRef<HTMLDivElement | null>(null);
  const pixiContainer = usePixiHudLayer("create-room-modal", { zIndex: 105 });
  const pixiGraphicsRef = React.useRef<PIXI.Graphics | null>(null);

  const cleanupGraphics = React.useCallback(() => {
    const graphics = pixiGraphicsRef.current;
    if (!graphics) return;
    if (graphics.parent) {
      graphics.parent.removeChild(graphics);
    }
    graphics.destroy({ children: true });
    pixiGraphicsRef.current = null;
  }, []);

  // Pixi背景の描画とDOM同期
  React.useEffect(() => {
    if (!isOpen || !pixiContainer) {
      // モーダルが閉じられたらPixiリソースを破棄
      cleanupGraphics();
      return noopCleanup;
    }

    // Graphicsオブジェクトを作成
    const graphics = new PIXI.Graphics();
    graphics.zIndex = -10; // 最背面に配置
    pixiContainer.addChild(graphics);
    pixiGraphicsRef.current = graphics;

    // クリーンアップ
    return () => {
      cleanupGraphics();
    };
  }, [cleanupGraphics, isOpen, pixiContainer]);

  // DOM要素とPixiコンテナの位置・サイズ同期
  usePixiLayerLayout(modalRef, pixiContainer, {
    disabled: !isOpen || !pixiContainer,
    onUpdate: (layout) => {
      const graphics = pixiGraphicsRef.current;
      if (!graphics || layout.width <= 0 || layout.height <= 0) {
        return;
      }

      graphics.clear();
      graphics.position.set(layout.x, layout.y);
      drawSettingsModalBackground(PIXI, graphics, {
        width: layout.width,
        height: layout.height,
        dpr: layout.dpr,
      });
    },
  });

  return { modalRef };
}

