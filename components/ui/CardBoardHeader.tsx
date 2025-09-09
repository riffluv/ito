import { Box } from "@chakra-ui/react";
import { UNIFIED_LAYOUT } from "@/theme/layout";

/**
 * カードボードの共通ヘッダーコンポーネント
 * CentralCardBoard.tsxから抽出した再利用可能なコンポーネント
 */
interface CardBoardHeaderProps {
  children: React.ReactNode;
}

export function CardBoardHeader({ children }: CardBoardHeaderProps) {
  return (
    <Box
      textAlign="center"
      marginBottom={{ base: "1rem", md: "1.25rem" }}
      flex="0 0 auto"
      width="100%"
      maxWidth="var(--board-max-width)"
      marginInline="auto"
      css={{
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
          marginBottom: "0.75rem",
        },
      }}
    >
      {/* QUIET LUXURY INSTRUCTION - Guidance */}
      <Box
        css={{
          fontWeight: 500,
          fontSize: "0.9375rem",
          lineHeight: 1.4,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
          letterSpacing: "-0.01em",
          color: "rgba(255,255,255,0.8)",
          padding: "8px 16px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: "12px",
          backdropFilter: "blur(4px)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          transition: "all 0.2s ease",
          display: "inline-block",

          "&:hover": {
            background: "rgba(255,255,255,0.05)",
            borderColor: "rgba(255,255,255,0.08)",
            transform: "translateY(-1px)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default CardBoardHeader;