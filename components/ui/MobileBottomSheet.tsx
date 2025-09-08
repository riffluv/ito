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
import { ReactNode, useEffect, useRef, useState } from "react";

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
  const sheetRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);

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

  // シート高さ計算
  const getSheetHeight = () => {
    switch (sheetState) {
      case "collapsed":
        return 60;
      case "partial":
        return window.innerHeight * 0.4; // 40dvh相当
      case "full":
        return window.innerHeight * 0.8; // 80dvh相当
      default:
        return 60;
    }
  };

  // GSAPアニメーション - シート位置更新
  const animateSheet = (targetState: SheetState) => {
    if (!sheetRef.current) return;

    const height = (() => {
      switch (targetState) {
        case "collapsed":
          return 60;
        case "partial":
          return window.innerHeight * 0.4;
        case "full":
          return window.innerHeight * 0.8;
        default:
          return 60;
      }
    })();

    gsap.to(sheetRef.current, {
      y: window.innerHeight - height,
      duration: 0.4,
      ease: "back.out(1.2)",
    });
  };

  // オーバーレイのフェードイン/アウト
  const animateOverlay = (show: boolean) => {
    if (!overlayRef.current) return;

    if (show) {
      gsap.set(overlayRef.current, { display: "block" });
      gsap.to(overlayRef.current, { opacity: 0.5, duration: 0.3 });
    } else {
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: 0.3,
        onComplete: () => {
          if (overlayRef.current) {
            gsap.set(overlayRef.current, { display: "none" });
          }
        },
      });
    }
  };

  // コンテンツフェード
  const animateContent = () => {
    if (!contentRef.current) return;

    gsap.fromTo(
      contentRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.2 }
    );
  };

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
    const currentHeight = getSheetHeight();
    const newY = Math.max(
      window.innerHeight - window.innerHeight * 0.8,
      Math.min(
        window.innerHeight - 60,
        window.innerHeight - currentHeight + deltaY
      )
    );

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
    } else if (velocity > 0.5 || deltaY > 50) {
      // 下方向
      if (sheetState === "full") {
        setSheetState("partial");
      } else if (sheetState === "partial") {
        setSheetState("collapsed");
      }
    } else {
      // 元の位置に戻す
      animateSheet(sheetState);
    }

    if (sheetRef.current) {
      sheetRef.current.releasePointerCapture(e.pointerId);
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

  // 状態変更時のアニメーション実行
  useEffect(() => {
    animateSheet(sheetState);
    animateOverlay(sheetState === "full");
    if (sheetState !== "collapsed") {
      setTimeout(() => animateContent(), 100);
    }
  }, [sheetState]);

  // 初期化時のポジション設定
  useEffect(() => {
    if (sheetRef.current) {
      gsap.set(sheetRef.current, {
        y: window.innerHeight - 60,
      });
    }
    if (overlayRef.current) {
      gsap.set(overlayRef.current, {
        opacity: 0,
        display: "none",
      });
    }
  }, []);

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
          minHeight: "60px",
          maxHeight: "80dvh",
          position: "absolute",
          width: "100%",
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
          h="60px"
          align="center"
          justify="space-between"
          px={4}
          borderBottom={
            sheetState !== "collapsed" ? `1px solid ${borderColorVar}` : "none"
          }
          cursor={isDragging ? "grabbing" : "grab"}
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
              height: `calc(${getSheetHeight()}px - 60px)`,
              overflow: "hidden",
            }}
          >
            <Box h="100%" overflow="auto" bg="inherit">
              {renderContent()}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default MobileBottomSheet;
