"use client";

import { AppButton } from "@/components/ui/AppButton";
import { Box, Text, VStack } from "@chakra-ui/react";
import { ArrowLeft } from "lucide-react";

export function RulesFooterSection(props: {
  onBackToMenu: () => void | Promise<void>;
}) {
  const { onBackToMenu } = props;

  return (
    <VStack gap={10} mt={{ base: 16, md: 20 }}>
      <Box
        p={4}
        bg="bgSubtle"
        border="borders.retrogameThin"
        borderColor="whiteAlpha.60"
        borderRadius={0}
        mx="auto"
        maxW="2xl"
        textAlign="center"
        boxShadow="1px 1px 0 rgba(0,0,0,0.6)"
      >
        <Text
          fontSize="sm"
          color="white"
          fontFamily="monospace"
          textShadow="1px 1px 0px #000"
        >
          長々と書きましたが、ルールはとてもシンプルです。
          <br />
          まずはプレイしてみよう！
        </Text>
      </Box>

      {/* 戻るボタン */}
      <AppButton onClick={onBackToMenu} visual="solid" palette="brand" size="lg">
        <ArrowLeft size={20} style={{ marginRight: "8px" }} />
        メインメニューに戻る
      </AppButton>
    </VStack>
  );
}

