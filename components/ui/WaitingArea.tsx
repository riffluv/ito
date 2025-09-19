"use client";
import { useDroppable } from "@dnd-kit/core";
import WaitingAreaCard from "@/components/ui/WaitingAreaCard";
import { useId } from "react";
import type { PlayerDoc } from "@/lib/types";
import { DOCK_BOTTOM_DESKTOP, DOCK_BOTTOM_MOBILE } from "@/lib/ui/layout";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
import { Box, Text, VStack, VisuallyHidden } from "@chakra-ui/react";

export interface WaitingAreaProps {
  players: (PlayerDoc & { id: string })[];
  title?: string;
  isDraggingEnabled?: boolean; // ドラッグ機能有効化フラグ
  meId?: string; // 自分のID（本人のみドラッグ可能にする）
  displayMode?: "full" | "minimal"; // カード表示モード
  roomId?: string; // Broadcast 受信のため
  returnDropZoneId?: string;
}

export default function WaitingArea({
  players,
  title = "",
  isDraggingEnabled = false,
  meId,
  displayMode = "full",
  roomId,
  returnDropZoneId,
}: WaitingAreaProps) {
  const generatedDropId = useId();
  const dropZoneId = returnDropZoneId ?? `waiting-area-${generatedDropId.replace(/:/g, "")}`;
  const dropZoneEnabled = Boolean(returnDropZoneId && isDraggingEnabled);
  const { setNodeRef: setReturnZoneRef, isOver: isReturnZoneOver } = useDroppable({
    id: dropZoneId,
    disabled: !dropZoneEnabled,
  });
  const showEmptyDropHint = dropZoneEnabled && players.length === 0;

  // Broadcast 同期は一時停止（警告回避）。サーバ確定＋常時購読で十分速い同期を実現済み。
  return (
    <VStack
      width="100%"
      maxWidth="600px"
      mx="auto"
      mt={{ base: 4, md: 6 }}
      p={{ base: 3, md: 4 }}
      gap={4}
      // 上品な控えめスタイル（AIテンプレ脱却）
      // borderなし - 透明背景でクリーンな表示
      borderRadius="lg"
      css={{
        // 背景なしでクリーンな表示
        background: "transparent",
        // シャドウも最小限に（ボーダーが主役）
        boxShadow: "none",
        // 150DPI専用: WaitingArea自体を圧縮
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
          marginTop: "0.5rem !important",
          padding: "0.5rem !important",
        },
      }}
    >
      {title && (
        <Text
          textAlign="center"
          fontWeight={600}
          fontSize={{ base: "13px", md: "14px" }}
          letterSpacing="0.5px"
          color={UI_TOKENS.COLORS.whiteAlpha95}
          mb={3}
          // メインメニューと同じ上品なフォント
          fontFamily='-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif'
          textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
        >
          {title}
        </Text>
      )}


      <Box
        ref={dropZoneEnabled ? setReturnZoneRef : undefined}
        display="flex"
        justifyContent="center"
        alignItems={showEmptyDropHint ? "center" : "flex-start"}
        gap={UNIFIED_LAYOUT.SPACING.CARD_GAP}
        data-drop-enabled={dropZoneEnabled ? "true" : undefined}
        data-drop-over={dropZoneEnabled && isReturnZoneOver ? "true" : undefined}
        css={{
          position: "relative",
          flexWrap: "wrap",
          minHeight: dropZoneEnabled && showEmptyDropHint ? "64px" : undefined,
          transition: "background 0.2s ease, box-shadow 0.2s ease",
          ...(dropZoneEnabled && {
            "&::before": {
              content: '""',
              position: "absolute",
              inset: showEmptyDropHint ? "-16px" : "-12px",
              borderRadius: "24px",
              background: isReturnZoneOver ? "rgba(148, 163, 184, 0.12)" : "transparent",
              border: isReturnZoneOver
                ? `1px dashed ${UI_TOKENS.COLORS.whiteAlpha70}`
                : "1px dashed transparent",
              transition: "background 0.2s ease, border-color 0.2s ease",
              pointerEvents: "none",
            },
          }),
          // ��̃J�[�h�G���A�ƑS�������X�^�C��
          // DPI125%�p�œK��
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            gap: "8px", // DPI125%�p�œK��
          },
          // DPI 150%�Ή��F�󂫃X���b�g�Ɠ���
          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)": {
            gap: `${UNIFIED_LAYOUT.DPI_150.SPACING.CARD_GAP} !important`, // �����Ԋu�F18px
          },
          // ���o�C���Ή�
          "@media (max-width: 480px)": {
            gap: "10px",
          },
          "@media (max-width: 360px)": {
            gap: "6px",
          },
        }}
      >
        {/* �G�L�X�p�[�g���[�h: �����̃J�[�h�̂ݕ\�� */}
        {displayMode === "minimal"
          ? players.filter(p => p.id === meId).map((p) => (
              <WaitingAreaCard
                key={p.id}
                player={p}
                isDraggingEnabled={isDraggingEnabled}
                meId={meId}
              />
            ))
          : players.map((p) => (
              <WaitingAreaCard
                key={p.id}
                player={p}
                isDraggingEnabled={isDraggingEnabled}
                meId={meId}
              />
            ))
        }
        {dropZoneEnabled && (
          <VisuallyHidden>
            {showEmptyDropHint
              ? "カードを下方向にドラッグすると手札に戻せます"
              : "カードを待機エリアに戻すにはここにドロップしてください"}
          </VisuallyHidden>
        )}
      </Box>

      <Box as="style">{`@keyframes pulseW{0%{opacity:.85}100%{opacity:1}}`}</Box>
    </VStack>
  );
}
