"use client";

import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { Box, Heading, List, Text } from "@chakra-ui/react";

const ONLINE_FEATURES = [
  {
    title: "▶ リアルタイム協力",
    desc: "全員が連想ワード（ヒント）だけを出し合います。全員分のカードが揃ったら、ドラッグ＆ドロップで並び順を共同編集し、ホストの判定で結果が公開されます。",
  },
  {
    title: "▶ 基本ルール",
    desc: "数字そのものを直接口にすることは禁止。ヒントの抽象度や範囲感を揃えて協力しましょう。",
  },
] as const;

export function RulesOnlineFeaturesSection() {
  return (
    <Box
      bg="bgPanel"
      border="borders.retrogame"
      borderColor="whiteAlpha.90"
      borderRadius={0}
      boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
      p={{ base: scaleForDpi("1.6rem"), md: scaleForDpi("2.1rem") }}
    >
      <Heading
        size="lg"
        color="rgba(255,255,255,0.95)"
        fontFamily="monospace"
        textShadow="0 2px 4px rgba(0,0,0,0.8)"
        textAlign="center"
        mb={scaleForDpi("1.6rem")}
        pb={scaleForDpi("0.8rem")}
        css={{
          borderBottom: "2px solid rgba(255,255,255,0.15)",
        }}
      >
        Online版の特徴
      </Heading>

      <List.Root as="ul" gap="4" style={{ listStyleType: "none" }}>
        {ONLINE_FEATURES.map((mode, index) => (
          <List.Item key={index}>
            <Box
              p={4}
              borderRadius={0}
              border="borders.retrogameThin"
              borderColor="whiteAlpha.60"
              bg="bgSubtle"
              boxShadow="1px 1px 0 rgba(0,0,0,0.6)"
            >
              <Text
                fontWeight="bold"
                color="white"
                mb={2}
                fontFamily="monospace"
                textShadow="1px 1px 0px #000"
              >
                {mode.title}
              </Text>
              <Text
                color="white"
                fontSize="sm"
                lineHeight="1.6"
                fontFamily="monospace"
                textShadow="1px 1px 0px #000"
              >
                {mode.desc}
              </Text>
            </Box>
          </List.Item>
        ))}
      </List.Root>
    </Box>
  );
}

