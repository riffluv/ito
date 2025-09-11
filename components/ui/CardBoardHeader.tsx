import { Box } from "@chakra-ui/react";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";

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
          color: UI_TOKENS.COLORS.textMuted,
          padding: "8px 16px",
          background: UI_TOKENS.COLORS.whiteAlpha05,
          border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha05}`,
          borderRadius: "12px",
          backdropFilter: "blur(4px)",
          boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
          transition: `transform 0.2s ${UI_TOKENS.EASING.standard}, background-color 0.2s ${UI_TOKENS.EASING.standard}, border-color 0.2s ${UI_TOKENS.EASING.standard}, box-shadow 0.2s ${UI_TOKENS.EASING.standard}`,
          display: "inline-block",

          "&:hover": {
            background: UI_TOKENS.COLORS.whiteAlpha10,
            borderColor: UI_TOKENS.COLORS.whiteAlpha10,
            transform: "translateY(-1px)",
            boxShadow: UI_TOKENS.SHADOWS.panelDistinct,
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default CardBoardHeader;
