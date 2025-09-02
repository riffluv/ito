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
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default CardBoardContainer;