"use client";

import { AppButton } from "@/components/ui/AppButton";
import { AppIconButton } from "@/components/ui/AppIconButton";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Flex, Text, VisuallyHidden } from "@chakra-ui/react";
import { gsap } from "gsap";
import {
  ChevronDown,
  ChevronUp,
  Menu,
  MessageCircle,
  Users,
} from "lucide-react";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

const SAFE_AREA_BOTTOM = "env(safe-area-inset-bottom, 0px)";
const SAFE_AREA_TOP = "env(safe-area-inset-top, 0px)";
const SHEET_HANDLE_HEIGHT = 72;
const PARTIAL_HEIGHT_RATIO = 0.45;
const FULL_HEIGHT_RATIO = 0.9;

const getViewportHeight = () => {
  if (typeof window === "undefined") return 0;
  return window.visualViewport?.height ?? window.innerHeight;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/**
 * MobileBottomSheet: モバイル用ボトムシート実装
 *
 * 機能:
 * - スワイプ操作でチャット/参加者リスト切り替え
 * - ハンバーガーメニューでサイドバーアクセス
 * - フルスクリーン展開/縮小
 * - UNIFIED_LAYOUTシステム準拠
 * - アクセシビリティ配慮
 */
export interface MobileBottomSheetProps {
  /** チャットパネル内容 */
  chatPanel?: ReactNode;
  /** サイドバー内容 */
  sidebar?: ReactNode;
  /** 右パネル内容 */
  rightPanel?: ReactNode;
}

type SheetState = "collapsed" | "partial" | "full";
type ContentType = "chat" | "participants" | "sidebar";

export function MobileBottomSheet({
  chatPanel,
  sidebar,
  rightPanel,
}: MobileBottomSheetProps) {
  const [sheetState, setSheetState] = useState<SheetState>("collapsed");
  const [contentType, setContentType] = useState<ContentType>("chat");
  const [isDragging, setIsDragging] = useState(false);
  const [, setViewportTick] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const prefersReduced = useReducedMotionPreference();

  // ドラッグ状態
  const dragStartY = useRef(0);
  const currentY = useRef(0);

  // テーマカラー（Chakra UI v3対応）
  const bgColorVar = "var(--colors-panelBg)";
  const borderColorVar = "var(--colors-borderDefault)";
  const buttonBg = "panelSubBg";
  const buttonHoverBg = "cardHoverBg";

  // アクセシビリティ - フォーカス管理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!sheetRef.current) return;

      // Escキーでシートを閉じる
      if (event.key === "Escape" && sheetState !== "collapsed") {
        event.preventDefault();
        setSheetState("collapsed");
      }

      // Tab + Shift + Enterでシート展開
      if (
        event.key === "Enter" &&
        event.shiftKey &&
        sheetState === "collapsed"
      ) {
        event.preventDefault();
        setSheetState("partial");
        // 最初のボタンにフォーカス
        setTimeout(() => firstButtonRef.current?.focus(), 100);
      }

      // 矢印キーでコンテンツ切り替え（シートが開いている時のみ）
      if (sheetState !== "collapsed") {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          if (contentType === "participants") setContentType("chat");
          else if (contentType === "sidebar") setContentType("participants");
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          if (contentType === "chat") setContentType("participants");
          else if (contentType === "participants") setContentType("sidebar");
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sheetState, contentType]);

  // SR向けライブリージョン（DOM直挿入をやめ、視覚非表示で常駐）
  const liveMessage = (() => {
    switch (sheetState) {
      case "collapsed":
        return "ボトムシートが閉じられました。Shift+Enterで開けます。";
      case "partial":
        return `ボトムシートが開かれました。現在は${contentType === "chat" ? "チャット" : contentType === "participants" ? "参加者リスト" : "メニュー"}を表示中です。`;
      case "full":
        return `ボトムシートが全画面表示されました。現在は${contentType === "chat" ? "チャット" : contentType === "participants" ? "参加者リスト" : "メニュー"}を表示中です。`;
      default:
        return "";
    }
  })();

  const getSheetHeight = useCallback(
    (target: SheetState): number => {
      const viewportHeight = getViewportHeight();
      if (viewportHeight <= 0) {
        if (target === "collapsed") return SHEET_HANDLE_HEIGHT;
        return SHEET_HANDLE_HEIGHT * (target === "partial" ? 2.2 : 3);
      }
      if (target === "collapsed") {
        return SHEET_HANDLE_HEIGHT;
      }
      if (target === "partial") {
        const partial = viewportHeight * PARTIAL_HEIGHT_RATIO;
        return Math.max(SHEET_HANDLE_HEIGHT * 2, partial);
      }
      const full = viewportHeight * FULL_HEIGHT_RATIO;
      return Math.max(full, viewportHeight - SHEET_HANDLE_HEIGHT);
    },
    []
  );

  const getSheetOffset = useCallback(
    (target: SheetState): number => {
      const viewportHeight = getViewportHeight();
      return clamp(
        viewportHeight - getSheetHeight(target),
        0,
        Math.max(viewportHeight - SHEET_HANDLE_HEIGHT, 0)
      );
    },
    [getSheetHeight]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const viewport = window.visualViewport;
    if (!viewport) return undefined;
    const handleViewportChange = () => {
      setViewportTick((tick) => tick + 1);
      if (sheetRef.current) {
        const y = getSheetOffset(sheetState);
        gsap.set(sheetRef.current, { y });
      }
    };
    viewport.addEventListener("resize", handleViewportChange);
    viewport.addEventListener("scroll", handleViewportChange);
    return () => {
      viewport.removeEventListener("resize", handleViewportChange);
      viewport.removeEventListener("scroll", handleViewportChange);
    };
  }, [getSheetOffset, sheetState]);

  // GSAPアニメーション - シート位置更新
  const animateSheet = useCallback(
    (targetState: SheetState) => {
      if (!sheetRef.current) return;
      const targetOffset = getSheetOffset(targetState);
      gsap.to(sheetRef.current, {
        y: targetOffset,
        duration: 0.4,
        ease: "back.out(1.2)",
      });
    },
    [getSheetOffset]
  );

  // オーバーレイのフェードイン/アウト
  const animateOverlay = useCallback((show: boolean) => {
    if (!overlayRef.current) return;

    if (show) {
      gsap.set(overlayRef.current, { display: "block" });
      gsap.to(overlayRef.current, { opacity: 0.5, duration: 0.3 });
      return;
    }

    gsap.to(overlayRef.current, {
      opacity: 0,
      duration: 0.3,
      onComplete: () => {
        if (overlayRef.current) {
          gsap.set(overlayRef.current, { display: "none" });
        }
      },
    });
  }, []);

  // コンテンツフェード
  const animateContent = useCallback(() => {
    if (!contentRef.current) return;

    gsap.fromTo(
      contentRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.2 }
    );
  }, []);

  // ドラッグハンドラー - ネイティブPointerEvent使用
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!sheetRef.current) return;

    setIsDragging(true);
    dragStartY.current = e.clientY;
    currentY.current = e.clientY;

    sheetRef.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !sheetRef.current) return;

    const deltaY = e.clientY - dragStartY.current;
    const viewportHeight = getViewportHeight();
    const currentHeight = getSheetHeight(sheetState);
    const minY = getSheetOffset("full");
    const maxY = getSheetOffset("collapsed");
    const proposedY = viewportHeight - currentHeight + deltaY;
    const newY = clamp(proposedY, minY, maxY);
    gsap.set(sheetRef.current, { y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;

    setIsDragging(false);
    const deltaY = e.clientY - dragStartY.current;
    const velocity = deltaY / 100; // 簡易速度計算

    // 垂直方向のジェスチャー判定
    if (velocity < -0.5 || deltaY < -50) {
      // 上方向
      if (sheetState === "collapsed") {
        setSheetState("partial");
      } else if (sheetState === "partial") {
        setSheetState("full");
      }
      if (sheetRef.current) {
        sheetRef.current.releasePointerCapture(e.pointerId);
      }
      return;
    }

    if (velocity > 0.5 || deltaY > 50) {
      // 下方向
      if (sheetState === "full") {
        setSheetState("partial");
      } else if (sheetState === "partial") {
        setSheetState("collapsed");
      }
      if (sheetRef.current) {
        sheetRef.current.releasePointerCapture(e.pointerId);
      }
      return;
    }

    if (sheetRef.current) {
      sheetRef.current.releasePointerCapture(e.pointerId);
      const currentY =
        (gsap.getProperty(sheetRef.current, "y") as number) ??
        getSheetOffset(sheetState);
      const collapsedThreshold =
        (getSheetOffset("collapsed") + getSheetOffset("partial")) / 2;
      const fullThreshold =
        (getSheetOffset("full") + getSheetOffset("partial")) / 2;

      if (currentY <= fullThreshold) {
        setSheetState("full");
      } else if (currentY >= collapsedThreshold) {
        setSheetState("collapsed");
      } else {
        setSheetState("partial");
      }
    } else {
      animateSheet(sheetState);
    }
  };

  // コンテンツレンダリング
  const renderContent = () => {
    switch (contentType) {
      case "chat":
        return chatPanel || <Text p={4}>チャット機能は準備中です</Text>;
      case "participants":
        return rightPanel || <Text p={4}>参加者リストは準備中です</Text>;
      case "sidebar":
        return sidebar || <Text p={4}>サイドバー機能は準備中です</Text>;
      default:
        return <Text p={4}>コンテンツがありません</Text>;
    }
  };

  const contentHeight = Math.max(
    getSheetHeight(sheetState) - SHEET_HANDLE_HEIGHT,
    0
  );

  // 状態変更時のアニメーション実行
  useEffect(() => {
    let contentTimer: number | undefined;

    if (prefersReduced) {
      // 最小限の状態にセット
      if (sheetRef.current)
        gsap.set(sheetRef.current, {
          y: getSheetOffset(sheetState),
        });
      if (overlayRef.current)
        gsap.set(overlayRef.current, {
          opacity: sheetState === "full" ? 0.5 : 0,
          display: sheetState === "full" ? "block" : "none",
        });
      if (contentRef.current)
        gsap.set(contentRef.current, { opacity: 1, y: 0 });
    } else {
      animateSheet(sheetState);
      animateOverlay(sheetState === "full");
      if (sheetState !== "collapsed") {
        contentTimer = window.setTimeout(() => animateContent(), 100);
      }
    }

    return () => {
      if (contentTimer) {
        window.clearTimeout(contentTimer);
      }
    };
  }, [
    sheetState,
    prefersReduced,
    getSheetOffset,
    animateSheet,
    animateOverlay,
    animateContent,
  ]);

  // 初期化時のポジション設定
  useEffect(() => {
    const sheetEl = sheetRef.current;
    const overlayEl = overlayRef.current;
    const contentEl = contentRef.current;

    if (sheetEl) {
      gsap.set(sheetEl, {
        y: getSheetOffset("collapsed"),
      });
    }
    if (overlayEl) {
      gsap.set(overlayEl, {
        opacity: 0,
        display: "none",
      });
    }

    return () => {
      try {
        if (sheetEl) {
          gsap.killTweensOf(sheetEl);
          gsap.set(sheetEl, {
            clearProps: "transform,opacity,x,y,scale",
          });
        }
        if (overlayEl) {
          gsap.killTweensOf(overlayEl);
          gsap.set(overlayEl, { clearProps: "opacity,display" });
        }
        if (contentEl) {
          gsap.killTweensOf(contentEl);
          gsap.set(contentEl, { clearProps: "opacity,y" });
        }
      } catch {
        // ignore
      }
    };
  }, [getSheetOffset]);

  // アクティブボタンのスタイル
  const getButtonStyle = (type: ContentType) => ({
    bg: contentType === type ? "accent" : buttonBg,
    color: contentType === type ? "panelBannerFg" : "inherit",
    _hover: {
      bg: contentType === type ? "accent" : buttonHoverBg,
    },
  });

  return (
    <Box
      position="fixed"
      bottom="0"
      left="0"
      right="0"
      zIndex="modal"
      pointerEvents="none" // 背景部分はクリック不可
      paddingBottom={SAFE_AREA_BOTTOM}
      paddingTop={SAFE_AREA_TOP}
    >
      {/* オーバーレイ (フルスクリーン時) */}
      <Box
        ref={overlayRef}
        position="absolute"
        inset="0"
        height="100dvh"
        backgroundColor="black"
        pointerEvents="auto"
        display="none"
        onClick={() => setSheetState("partial")}
        aria-label="ボトムシートを閉じる"
      />

      {/* ボトムシート本体 */}
      <Box
        ref={sheetRef}
        style={{
          backgroundColor: bgColorVar,
          borderTopLeftRadius: "16px",
          borderTopRightRadius: "16px",
          borderTop: `1px solid ${borderColorVar}`,
          borderLeft: `1px solid ${borderColorVar}`,
          borderRight: `1px solid ${borderColorVar}`,
          boxShadow: UNIFIED_LAYOUT.ELEVATION.PANEL.DISTINCT,
          pointerEvents: "auto",
          minHeight: `${SHEET_HANDLE_HEIGHT}px`,
          maxHeight: "80dvh",
          position: "absolute",
          width: "100%",
          paddingBottom: SAFE_AREA_BOTTOM,
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        // アクセシビリティ属性
        role="dialog"
        aria-modal={sheetState === "full"}
        aria-label="モバイル操作パネル"
        aria-describedby="bottom-sheet-description"
        tabIndex={sheetState === "collapsed" ? -1 : 0}
      >
        {/* 視覚には表示しないSR用ライブメッセージ */}
        <VisuallyHidden aria-live="polite">{liveMessage}</VisuallyHidden>
        {/* アクセシビリティ - スクリーンリーダー用説明 */}
        <Box
          id="bottom-sheet-description"
          position="absolute"
          left="-10000px"
          width="1px"
          height="1px"
          overflow="hidden"
        >
          モバイル用ボトムシートです。上下にドラッグして展開・縮小、左右にスワイプでコンテンツ切り替えが可能です。
          キーボード操作：Escで閉じる、Shift+Enterで開く、左右矢印キーでコンテンツ切り替え
        </Box>
        {/* ドラッグハンドル */}
        <Flex
          h={`${SHEET_HANDLE_HEIGHT}px`}
          align="center"
          justify="space-between"
          px={4}
          borderBottom={
            sheetState !== "collapsed" ? `1px solid ${borderColorVar}` : "none"
          }
          cursor={isDragging ? "grabbing" : "grab"}
          data-interactive="true"
          css={{ touchAction: "none", WebkitUserSelect: "none" }}
        >
          {/* ドラッグインジケーター */}
          <Box
            position="absolute"
            top="8px"
            left="50%"
            transform="translateX(-50%)"
            w="36px"
            h="4px"
            bg="gray.300"
            rounded="full"
            aria-hidden="true"
          />

          {/* 左側: ナビゲーションボタン */}
          <Flex gap={1}>
            <AppButton
              size="sm"
              variant="ghost"
              onClick={() => setContentType("chat")}
              aria-label="チャットを表示"
              aria-pressed={contentType === "chat"}
              {...getButtonStyle("chat")}
            >
              <MessageCircle size={16} />
              <Text ml={1}>チャット</Text>
            </AppButton>
            <AppButton
              size="sm"
              variant="ghost"
              onClick={() => setContentType("participants")}
              aria-label="参加者リストを表示"
              aria-pressed={contentType === "participants"}
              {...getButtonStyle("participants")}
            >
              <Users size={16} />
              <Text ml={1}>参加者</Text>
            </AppButton>
            <AppButton
              size="sm"
              variant="ghost"
              onClick={() => setContentType("sidebar")}
              aria-label="メニューを表示"
              aria-pressed={contentType === "sidebar"}
              {...getButtonStyle("sidebar")}
            >
              <Menu size={16} />
              <Text ml={1}>メニュー</Text>
            </AppButton>
          </Flex>

          {/* 右側: 展開/縮小ボタン */}
          <AppIconButton
            size="sm"
            variant="ghost"
            aria-label={
              sheetState === "collapsed"
                ? "ボトムシートを展開"
                : "ボトムシートを縮小"
            }
            onClick={() => {
              if (sheetState === "collapsed") {
                setSheetState("partial");
              } else {
                setSheetState("collapsed");
              }
            }}
          >
            {sheetState === "collapsed" ? (
              <ChevronUp size={20} />
            ) : (
              <ChevronDown size={20} />
            )}
          </AppIconButton>
        </Flex>

        {/* コンテンツエリア */}
        {sheetState !== "collapsed" && (
          <Box
            ref={contentRef}
            style={{
              height: `${contentHeight}px`,
              overflow: "hidden",
              touchAction: "auto",
            }}
          >
            <Box
              h="100%"
              overflow="auto"
              bg="inherit"
              css={{
                overscrollBehaviorY: "contain",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {renderContent()}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default MobileBottomSheet;
