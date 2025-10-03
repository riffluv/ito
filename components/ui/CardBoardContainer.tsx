import { Box } from "@chakra-ui/react";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";

/**
 * カードボードの共通コンテナコンポーネント
 * レイアウトとDPI対応を統一管理
 */
interface CardBoardContainerProps {
  children: React.ReactNode;
  isOver?: boolean;
  canDrop?: boolean;
}

export function CardBoardContainer({ 
  children, 
  isOver = false, 
  canDrop = false 
}: CardBoardContainerProps) {
  return (
    <Box
      flex="1"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="flex-start"
      overflow="visible"
      position="relative"
      minHeight={0}
    >
      <Box
        borderWidth="0"
        borderRadius="2xl"
        padding={{ base: 4, md: 6 }}
        minHeight="auto"
        width="100%"
        maxWidth="var(--board-max-width)"
        marginInline="auto"
        display="flex"
        flexWrap="wrap"
        justifyContent="center"
        alignContent="flex-start"
        alignItems="flex-start"
        gap={4}
        bg={UNIFIED_LAYOUT.SURFACE.BOARD_AREA}
        boxShadow="none"
        transition={`background-color 0.31s ${UI_TOKENS.EASING.standard}, border-color 0.31s ${UI_TOKENS.EASING.standard}, box-shadow 0.31s ${UI_TOKENS.EASING.standard}`} // AI感除去: 0.3s → 0.31s
        data-drop-target={isOver && canDrop ? "true" : "false"}
        css={{
          containerType: "inline-size",
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            gap: "calc(var(--spacing-2) + 2px)",
            padding: "0.6rem 0.9rem",
          },
          // DPI 150%対応：カード重なり防止（垂直方向大幅強化）
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
            gap: `${UNIFIED_LAYOUT.DPI_150.SPACING.CARD_GAP} !important`, // 水平間隔：18px
            rowGap: `${UNIFIED_LAYOUT.DPI_150.SPACING.ROW_GAP} !important`, // 垂直間隔：28px（重なり完全防止）
            padding: `${UNIFIED_LAYOUT.DPI_150.SPACING.COMPONENT_PADDING} !important`, // 10px（統一定数）
            minHeight: "auto !important",
            alignContent: "flex-start !important", // 上詰めで安定配置
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default CardBoardContainer;
