"use client";
import { AppButton } from "@/components/ui/AppButton";
import { Box, Text, VStack } from "@chakra-ui/react";
import { Plus, Sparkles } from "lucide-react";

export default function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Box
      textAlign="center"
      py={16}
      px={8}
      borderRadius="xl"
      border="2px dashed rgba(255,255,255,0.1)"
      bg="rgba(255,255,255,0.02)"
      css={{
        transition: "all 0.3s ease",
        _hover: {
          borderColor: "rgba(107,115,255,0.3)",
          bg: "rgba(107,115,255,0.03)",
        },
      }}
    >
      <VStack gap={6}>
        <Box
          w={16}
          h={16}
          mx="auto"
          borderRadius="xl"
          bg="linear-gradient(135deg, rgba(107,115,255,0.2) 0%, rgba(153,69,255,0.1) 100%)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          css={{
            animation: "float 3s ease-in-out infinite",
            "@keyframes float": {
              "0%, 100%": { transform: "translateY(0px)" },
              "50%": { transform: "translateY(-8px)" },
            },
          }}
        >
          <Sparkles size={24} color="rgba(107,115,255,0.8)" />
        </Box>

        <VStack gap={3}>
          <Text fontSize="xl" color="white" fontWeight={700}>
            まだアクティブなルームがありません
          </Text>
          <Text color="fgMuted" maxW="400px" lineHeight={1.6}>
            最初のルームを作成して、友達を招待しませんか？
          </Text>
        </VStack>

        <AppButton
          onClick={onCreate}
          visual="solid"
          palette="brand"
          css={{
            borderRadius: "lg",
            background: "linear-gradient(135deg, #6B73FF 0%, #9945FF 100%)",
            boxShadow: "0 4px 12px rgba(107,115,255,0.3)",
            fontWeight: 600,
            fontSize: "md",
            px: 8,
            py: 3,
            minW: "160px",
            transition: "all 0.2s ease",
            _hover: {
              transform: "translateY(-2px)",
              boxShadow: "0 8px 20px rgba(107,115,255,0.4)",
              background: "linear-gradient(135deg, #8B92FF 0%, #B565FF 100%)",
            },
          }}
        >
          <Plus size={18} style={{ marginRight: "8px" }} />
          新しいルーム作成
        </AppButton>
      </VStack>
    </Box>
  );
}
