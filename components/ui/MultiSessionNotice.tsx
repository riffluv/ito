import { AppButton } from "@/components/ui/AppButton";
import { UI_TOKENS } from "@/theme/layout";
import { Box, HStack, Text, VStack } from "@chakra-ui/react";

type MultiSessionNoticeProps = {
  onRequestActive?: () => void;
};

export function MultiSessionNotice({ onRequestActive }: MultiSessionNoticeProps) {
  return (
    <Box
      position="relative"
      zIndex={60}
      border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha80}`}
      borderRadius={0}
      boxShadow={UI_TOKENS.SHADOWS.panelDistinct}
      bg={UI_TOKENS.GRADIENTS.dqPanel}
      color={UI_TOKENS.COLORS.textBase}
      px={{ base: 4, md: 5 }}
      py={{ base: 4, md: 4 }}
      display="flex"
      flexDirection="column"
      gap={3}
      maxW={{ base: "100%", md: "520px" }}
      mx="auto"
      _before={{
        content: '""',
        position: "absolute",
        inset: "6px",
        border: `1px solid ${UI_TOKENS.COLORS.whiteAlpha20}`,
        pointerEvents: "none",
      }}
    >
      <VStack gap={2} align="center" textAlign="center">
        <Text
          fontSize={{ base: "sm", md: "md" }}
          fontWeight={800}
          letterSpacing="0.18em"
          textTransform="uppercase"
          fontFamily="monospace"
        >
          ▼ 別タブ操作中 ▼
        </Text>
        <Text fontSize={{ base: "md", md: "lg" }} fontWeight={700}>
          このタブは閲覧専用です
        </Text>
        <Text
          fontSize={{ base: "sm", md: "md" }}
          color={UI_TOKENS.COLORS.whiteAlpha80}
          lineHeight={1.6}
        >
          操作する場合は、下のボタンでこのタブをアクティブにしてください。
        </Text>
      </VStack>
      <HStack gap={3} flexWrap="wrap" justify="center">
        <AppButton palette="brand" size="md" onClick={onRequestActive}>
          このタブで操作する
        </AppButton>
      </HStack>
    </Box>
  );
}
