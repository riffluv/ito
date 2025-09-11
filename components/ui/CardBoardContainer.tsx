import { Box } from "@chakra-ui/react";
import { UNIFIED_LAYOUT } from "@/theme/layout";

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
        bg="transparent"
        boxShadow="none"
        transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        data-drop-target={isOver && canDrop ? "true" : "false"}
        css={{
          containerType: "inline-size",
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            gap: "calc(var(--spacing-2) + 2px)",
            padding: "0.6rem 0.9rem",
          },
          // DPI 150%対応：カード重なり防止（垂直方向強化）
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
            gap: UNIFIED_LAYOUT.DPI_150.SPACING.CARD_GAP, // 統一定数活用（16px）
            rowGap: UNIFIED_LAYOUT.DPI_150.SPACING.INNER_SPACING, // 垂直間隔：20px（定数活用）
            padding: "0.5rem 0.75rem !important", // コンパクト化
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