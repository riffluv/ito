"use client";
import { AppButton } from "@/components/ui/AppButton";
import { Box, Text, VStack } from "@chakra-ui/react";
import { Plus } from "lucide-react";

export default function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Box
      textAlign="center"
      py={16}
      px={8}
      borderRadius={0}
      border="3px solid rgba(255,255,255,0.2)"
      bg="rgba(8,9,15,0.85)"
      css={{
        transition: "border-color 0.2s ease",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.4)",
        _hover: {
          borderColor: "rgba(255,255,255,0.4)",
        },
      }}
    >
      <VStack gap={8}>
        <Box
          w={12}
          h={12}
          mx="auto"
          borderRadius={0}
          bg="rgba(255,255,255,0.1)"
          border="2px solid rgba(255,255,255,0.3)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          css={{
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.3)",
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
            color="rgba(255,255,255,0.7)" 
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
            bg: "rgba(255,255,255,0.9)",
            color: "#000",
            border: "3px solid #fff",
            fontWeight: 700,
            fontSize: "sm",
            px: 6,
            py: 3,
            minW: "180px",
            fontFamily: "monospace",
            letterSpacing: "0.5px",
            textShadow: "none",
            boxShadow: "inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.3)",
            transition: "all 0.15s ease",
            _hover: {
              transform: "translateY(1px)",
              boxShadow: "inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.3)",
            },
            _active: {
              transform: "translateY(2px)",
              boxShadow: "inset 0 2px 0 rgba(0,0,0,0.2), inset 0 -1px 0 rgba(255,255,255,0.1)",
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
