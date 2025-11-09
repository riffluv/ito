"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { Box, Input, HStack, Text } from "@chakra-ui/react";
import { AppButton } from "@/components/ui/AppButton";
import Tooltip from "@/components/ui/Tooltip";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { usePixiHudLayer } from "@/components/ui/pixi/PixiHudStage";
import { usePixiLayerLayout } from "@/components/ui/pixi/usePixiLayerLayout";
import PIXI from "@/lib/pixi/instance";
import { drawSettingsModalBackground } from "@/lib/pixi/settingsModalBackground";

/**
 * 🎮 InputModal - ドラクエ風連想ワード入力モーダル
 *
 * 設計方針:
 * - スペースキー/Escキーで開閉
 * - フッター高さ基準のポータル配置
 * - GSAP演出（scale + opacity）
 * - アクセシビリティ対応（role=dialog, フォーカス制御）
 * - ドラクエ風UI統一デザイン
 */

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  text: string;
  onTextChange: (value: string) => void;
  onDecide: () => void;
  onClear: () => void;
  onSubmit: () => void;
  canDecide: boolean;
  canClear: boolean;
  canSubmit: boolean;
  actionLabel: string;
  decideTooltip: string;
  clearTooltip: string;
  submitTooltip: string;
  footerHeight?: number;
}

// ドラクエ風ボタンスタイル（MiniHandDockから統一）
const FOOTER_BUTTON_BASE_STYLES = {
  px: "14px",
  py: "10px",
  w: "68px",
  minW: "68px",
  bg: "rgba(28,32,42,0.95)",
  border: "none",
  borderRadius: "3px",
  fontWeight: 880,
  fontFamily: "'Courier New', monospace",
  fontSize: "15px",
  letterSpacing: "0.06em",
  textShadow: "1px 1px 0 rgba(0,0,0,0.9)",
  boxShadow: "3px 3px 0 rgba(0,0,0,.65), inset 2px 2px 0 rgba(255,255,255,0.15), inset -2px -2px 0 rgba(0,0,0,0.4), 0 0 0 2px rgba(255,255,255,0.88)",
  transform: "translate(.5px,-.5px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "177ms cubic-bezier(.2,1,.3,1)",
  _hover: {
    bg: "rgba(38,42,52,0.98)",
    transform: "translate(0,-1px)",
    boxShadow: "4px 4px 0 rgba(0,0,0,.7), inset 2px 2px 0 rgba(255,255,255,0.2), inset -2px -2px 0 rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.95)",
  },
  _active: {
    transform: "translate(1px,1px)",
    boxShadow: "2px 2px 0 rgba(0,0,0,.75), inset 2px 2px 0 rgba(255,255,255,0.1), inset -2px -2px 0 rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.82)",
  },
  _disabled: {
    bg: "rgba(28,32,42,0.5)",
    color: "rgba(255,255,255,0.4)",
    filter: "grayscale(0.8)",
    cursor: "not-allowed",
    boxShadow: "2px 2px 0 rgba(0,0,0,.4), inset 1px 1px 0 rgba(255,255,255,0.05), inset -1px -1px 0 rgba(0,0,0,0.3), 0 0 0 2px rgba(255,255,255,0.3)",
  },
} as const;

export function InputModal({
  isOpen,
  onClose,
  text,
  onTextChange,
  onDecide,
  onClear,
  onSubmit,
  canDecide,
  canClear,
  canSubmit,
  actionLabel,
  decideTooltip,
  clearTooltip,
  submitTooltip,
  footerHeight = 80,
}: InputModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotionPreference();

  // Pixi HUD レイヤー（モーダル背景用）
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pixiContainer = usePixiHudLayer("input-modal", {
    zIndex: 105,
  });
  const pixiGraphicsRef = useRef<PIXI.Graphics | null>(null);

  // 開閉アニメーション
  useEffect(() => {
    if (!modalRef.current) return;

    if (isOpen) {
      // 開く演出
      if (prefersReducedMotion) {
        gsap.set(modalRef.current, { opacity: 1, scale: 1, display: "block" });
      } else {
        gsap.fromTo(
          modalRef.current,
          { opacity: 0, scale: 0.92, display: "block" },
          {
            opacity: 1,
            scale: 1,
            duration: 0.28,
            ease: "power2.out",
          }
        );
      }

      // 入力欄にフォーカス
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      // 閉じる演出
      if (prefersReducedMotion) {
        gsap.set(modalRef.current, { opacity: 0, scale: 1, display: "none" });
      } else {
        gsap.to(modalRef.current, {
          opacity: 0,
          scale: 0.92,
          duration: 0.22,
          ease: "power2.in",
          onComplete: () => {
            gsap.set(modalRef.current, { display: "none" });
          },
        });
      }

      // 元のトリガーボタンにフォーカスを戻す
      if (triggerRef.current) {
        setTimeout(() => {
          triggerRef.current?.focus();
        }, 230);
      }
    }
  }, [isOpen, prefersReducedMotion]);

  // トリガー要素の記憶
  useEffect(() => {
    if (isOpen && typeof document !== "undefined") {
      triggerRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  // Enter/Escキーハンドリング
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && canDecide) {
        e.preventDefault();
        onDecide();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [canDecide, onDecide, onClose]
  );

  // Pixi背景の描画とDOM同期
  useEffect(() => {
    if (!isOpen || !pixiContainer) {
      // モーダルが閉じられたらPixiリソースを破棄
      if (pixiGraphicsRef.current) {
        pixiGraphicsRef.current.destroy({ children: true });
        pixiGraphicsRef.current = null;
      }
      return;
    }

    // Graphicsオブジェクトを作成
    const graphics = new PIXI.Graphics();
    graphics.zIndex = -10; // 最背面に配置
    pixiContainer.addChild(graphics);
    pixiGraphicsRef.current = graphics;

    // クリーンアップ
    return () => {
      if (pixiGraphicsRef.current) {
        pixiGraphicsRef.current.destroy({ children: true });
        pixiGraphicsRef.current = null;
      }
    };
  }, [isOpen, pixiContainer]);

  // DOM要素とPixiコンテナの位置・サイズ同期
  usePixiLayerLayout(contentRef, pixiContainer, {
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

  if (typeof window === "undefined") return null;

  return createPortal(
    <Box
      ref={modalRef}
      role="dialog"
      aria-label="連想ワード入力"
      aria-modal="true"
      position="fixed"
      bottom={`calc(${footerHeight}px + 16px)`}
      left="50%"
      transform="translateX(-50%)"
      zIndex={60}
      maxW={{ base: "calc(100vw - 32px)", md: "620px" }}
      w="100%"
      display="none"
      css={{
        pointerEvents: "auto",
      }}
    >
      <Box
        ref={contentRef}
        px={{ base: "18px", md: "24px" }}
        py={{ base: "16px", md: "20px" }}
        css={{
          position: "relative",
          background: "transparent",
          backdropFilter: "blur(14px) saturate(1.12)",
          border: "none",
          boxShadow: "none",
        }}
      >
        {/* タイトル */}
        <Text
          fontSize={{ base: "16px", md: "18px" }}
          fontWeight={880}
          fontFamily="'Courier New', monospace"
          color="rgba(255,255,255,0.98)"
          textShadow="2px 2px 0 rgba(0,0,0,0.9)"
          letterSpacing="0.08em"
          mb={{ base: "14px", md: "16px" }}
          position="relative"
          zIndex={20}
        >
          連想ワード入力
        </Text>

        {/* 入力フィールド */}
        <Input
          ref={inputRef}
          aria-label="連想ワード"
          placeholder="連想ワードを入力..."
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={50}
          size="md"
          position="relative"
          zIndex={20}
          bg="rgba(18,22,32,0.95)"
          color="rgba(255,255,255,0.98)"
          fontFamily="'Courier New', monospace"
          fontSize="17px"
          fontWeight={690}
          letterSpacing="0.04em"
          border="none"
          borderRadius="3px"
          boxShadow="inset 3px 3px 0 rgba(0,0,0,0.7), inset -1px -1px 0 rgba(255,255,255,0.08), 0 0 0 3px rgba(255,255,255,0.85)"
          minH="52px"
          mb={{ base: "16px", md: "20px" }}
          transition="box-shadow 168ms cubic-bezier(.2,1,.3,1)"
          _placeholder={{
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.06em",
          }}
          _focus={{
            boxShadow:
              "inset 3px 3px 0 rgba(0,0,0,0.7), inset -1px -1px 0 rgba(255,255,255,0.12), 0 0 0 3px rgba(255,255,255,0.98)",
            bg: "rgba(22,26,36,0.98)",
            outline: "none",
          }}
          _hover={{
            boxShadow:
              "inset 3px 3px 0 rgba(0,0,0,0.7), inset -1px -1px 0 rgba(255,255,255,0.1), 0 0 0 3px rgba(255,255,255,0.92)",
            bg: "rgba(20,24,34,0.96)",
          }}
        />

        {/* ボタン群 */}
        <HStack gap={{ base: "8px", md: "12px" }} justify="flex-end" position="relative" zIndex={20}>
          <Tooltip content={decideTooltip} showArrow openDelay={180}>
            <AppButton
              {...FOOTER_BUTTON_BASE_STYLES}
              size="sm"
              visual="solid"
              palette="brand"
              color="rgba(255,255,255,0.98)"
              onClick={onDecide}
              disabled={!canDecide}
              w="auto"
              minW="82px"
            >
              決定
            </AppButton>
          </Tooltip>
          <Tooltip content={clearTooltip} showArrow openDelay={180}>
            <AppButton
              {...FOOTER_BUTTON_BASE_STYLES}
              size="sm"
              visual="outline"
              palette="gray"
              color="rgba(255,255,255,0.92)"
              onClick={onClear}
              disabled={!canClear}
              w="auto"
              minW="82px"
            >
              クリア
            </AppButton>
          </Tooltip>
          <Tooltip content={submitTooltip} showArrow openDelay={180}>
            <AppButton
              {...FOOTER_BUTTON_BASE_STYLES}
              size="sm"
              visual="solid"
              palette="brand"
              color="rgba(255,255,255,0.98)"
              onClick={onSubmit}
              disabled={!canSubmit}
              w="auto"
              minW="98px"
            >
              {actionLabel}
            </AppButton>
          </Tooltip>
        </HStack>

        {/* 閉じるヒント */}
        <Text
          fontSize="12px"
          color="rgba(255,255,255,0.53)"
          fontFamily="'Courier New', monospace"
          textAlign="center"
          mt={{ base: "12px", md: "14px" }}
          letterSpacing="0.04em"
          position="relative"
          zIndex={20}
        >
          Escで閉じる
        </Text>
      </Box>
    </Box>,
    document.body
  );
}
