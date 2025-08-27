"use client";

import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Flex, Text, VisuallyHidden } from "@chakra-ui/react";
import { AppIconButton } from "@/components/ui/AppIconButton";
import { AppButton } from "@/components/ui/AppButton";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { ChevronUp, ChevronDown, MessageCircle, Users, Menu } from "lucide-react";
import { ReactNode, useState, useRef, useEffect } from "react";

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
  const constraintsRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  
  // refのコールバック関数
  const setRefs = (el: HTMLDivElement | null) => {
    (constraintsRef as any).current = el;
    (sheetRef as any).current = el;
  };

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
      if (event.key === "Enter" && event.shiftKey && sheetState === "collapsed") {
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
      case "collapsed": return "60px";
      case "partial": return "40vh";
      case "full": return "80vh";
      default: return "60px";
    }
  };

  // ドラッグハンドラー - モバイル最適化
  const handleDragEnd = (event: any, info: PanInfo) => {
    setIsDragging(false);
    const velocityY = info.velocity.y;
    const velocityX = info.velocity.x;
    const offsetY = info.offset.y;
    const offsetX = info.offset.x;

    // 横方向のスワイプ（コンテンツ切り替え）
    if (Math.abs(velocityX) > 400 || Math.abs(offsetX) > 100) {
      if (velocityX > 0 || offsetX > 0) {
        // 右スワイプ - 前のコンテンツ
        if (contentType === "participants") setContentType("chat");
        else if (contentType === "sidebar") setContentType("participants");
      } else {
        // 左スワイプ - 次のコンテンツ  
        if (contentType === "chat") setContentType("participants");
        else if (contentType === "participants") setContentType("sidebar");
      }
      return;
    }

    // 縦方向のスワイプ（シート展開/縮小）- より敏感な検出
    if (velocityY < -300 || offsetY < -50) {
      // 上方向の素早い動きまたは小さな上方向の移動でも反応
      if (sheetState === "collapsed") {
        setSheetState("partial");
      } else if (sheetState === "partial") {
        setSheetState("full");
      }
    } else if (velocityY > 300 || offsetY > 50) {
      // 下方向の素早い動きまたは小さな下方向の移動でも反応
      if (sheetState === "full") {
        setSheetState("partial");
      } else if (sheetState === "partial") {
        setSheetState("collapsed");
      }
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
      zIndex={1000}
      pointerEvents="none" // 背景部分はクリック不可
    >
      {/* オーバーレイ (フルスクリーン時) */}
      <AnimatePresence>
        {sheetState === "full" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              top: "-100vh",
              left: 0,
              right: 0,
              height: "100vh",
              backgroundColor: "black",
              pointerEvents: "auto",
            }}
            onClick={() => setSheetState("partial")}
            aria-label="ボトムシートを閉じる"
          />
        )}
      </AnimatePresence>

      {/* ボトムシート本体 */}
      <motion.div
        ref={setRefs}
        initial={{ y: "calc(100% - 60px)" }}
        animate={{ y: `calc(100% - ${getSheetHeight()})` }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
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
          maxHeight: "80vh",
        }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.1}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
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
          borderBottom={sheetState !== "collapsed" ? `1px solid ${borderColorVar}` : "none"}
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
              ref={firstButtonRef}
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
        <AnimatePresence mode="wait">
          {sheetState !== "collapsed" && (
            <motion.div
              key={`${contentType}-${sheetState}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              style={{
                height: `calc(${getSheetHeight()} - 60px)`,
                overflow: "hidden",
              }}
            >
              <Box 
                h="100%" 
                overflow="auto"
                bg="inherit"
              >
                {renderContent()}
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Box>
  );
}

export default MobileBottomSheet;
