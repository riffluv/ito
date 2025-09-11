"use client";
import { AppButton } from "@/components/ui/AppButton";
import { UI_TOKENS } from "@/theme/layout";
import { Box, Text, VStack } from "@chakra-ui/react";
import { Plus } from "lucide-react";

export default function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Box
      textAlign="center"
      py={16}
      px={8}
      borderRadius={0}
      border={`3px solid ${UI_TOKENS.COLORS.whiteAlpha20}`}
      bg={UI_TOKENS.COLORS.panelBg}
      css={{
        transition: `border-color 0.2s ${UI_TOKENS.EASING.standard}`,
        boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
        _hover: {
          borderColor: UI_TOKENS.COLORS.whiteAlpha40,
        },
      }}
    >
      <VStack gap={8}>
        <Box
          w={12}
          h={12}
          mx="auto"
          borderRadius={0}
          bg={UI_TOKENS.COLORS.whiteAlpha10}
          border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`}
          display="flex"
          alignItems="center"
          justifyContent="center"
          css={{
            boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
          }}
        >
          <Text fontSize="2xl" color="white" fontFamily="monospace" fontWeight={700}>
            ◆
          </Text>
        </Box>

        <VStack gap={4}>
          <Text 
            fontSize="lg" 
            color="white" 
            fontWeight={600}
            fontFamily="monospace"
            textShadow="1px 1px 0px #000"
            letterSpacing="0.5px"
          >
            ▼ まだアクティブなルームがありません ▼
          </Text>
          <Text 
            color={UI_TOKENS.COLORS.textMuted} 
            maxW="400px" 
            lineHeight={1.6}
            fontSize="sm"
            fontFamily="monospace"
          >
            最初のルームを作成して、友達を招待しませんか？
          </Text>
        </VStack>

        <AppButton
          onClick={onCreate}
          visual="solid"
          palette="brand"
          css={{
            borderRadius: 0,
            bg: UI_TOKENS.COLORS.whiteAlpha90,
            color: "#000",
            border: "3px solid #fff",
            fontWeight: 700,
            fontSize: "sm",
            px: 6,
            py: 3,
            minW: "180px",
            fontFamily: "monospace",
            letterSpacing: "0.5px",
            textShadow: UI_TOKENS.TEXT_SHADOWS.none,
            boxShadow: UI_TOKENS.SHADOWS.panelDistinct,
            transition: `transform 0.15s ${UI_TOKENS.EASING.standard}, box-shadow 0.15s ${UI_TOKENS.EASING.standard}`,
            _hover: {
              transform: "translateY(1px)",
              boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
            },
            _active: {
              transform: "translateY(2px)",
              boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
            },
          }}
        >
          <Plus size={16} style={{ marginRight: "6px" }} />
          新しいルーム作成
        </AppButton>
      </VStack>
    </Box>
  );
}
