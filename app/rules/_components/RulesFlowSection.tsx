"use client";

import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { Box, Heading, List, Text, VStack } from "@chakra-ui/react";

const FLOW_STEPS = [
  {
    title: "▶ １．お題を決める",
    desc: "1枚のお題カードを引いてテーマを決めます（例：「怖いもの」「好きな食べ物」など）。数字の大小を表現しやすいテーマが良いです。",
  },
  {
    title: "▶ ２．数字配布",
    desc: "各プレイヤーに 1〜100の数字がランダムに配られます。自分の数字は他のプレイヤーに教えてはいけません。",
  },
  {
    title: "▶ ３．表現（ヒント）",
    desc: "各プレイヤーは自分の数字を直接言わず、テーマに沿った「例え」や「イメージ」で表現します。",
  },
  {
    title: "▶ ４．カードを出す",
    desc: "表現を聞いて、自分のカードが小さいと思う順にカードを場に出していきます。",
  },
  {
    title: "▶ ５．判定",
    desc: "全てのカードを場に出し、小さい順に並んでいれば成功です。順序が入れ替わっていたら失敗です。",
  },
] as const;

export function RulesFlowSection() {
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
        ゲームの流れ
      </Heading>

      <List.Root
        as="ol"
        gap="3"
        style={{ listStyleType: "none", paddingLeft: 0, marginLeft: 0 }}
      >
        {FLOW_STEPS.map((step, index) => (
          <List.Item key={index}>
            <Box
              p={scaleForDpi("1.3rem")}
              mb={scaleForDpi("1.1rem")}
              border="borders.retrogameThin"
              borderColor="whiteAlpha.60"
              borderRadius={0}
              boxShadow="2px 2px 0 rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.4)"
              transition="all 0.18s cubic-bezier(.2,1,.3,1)"
              _hover={{
                transform: `translateY(-${
                  index % 2 === 0 ? "2.3" : "3.1"
                }px)`,
                boxShadow:
                  "3px 3px 0 rgba(0,0,0,0.8), 0 6px 16px rgba(0,0,0,0.6)",
                borderColor: "whiteAlpha.75",
              }}
              css={{
                background:
                  "linear-gradient(135deg, rgba(18,20,28,0.85) 0%, rgba(12,14,20,0.9) 100%)",
              }}
            >
              <VStack align="start" gap={scaleForDpi("0.55rem")} flex={1}>
                <Text
                  fontWeight="bold"
                  color="rgba(255,255,255,0.95)"
                  fontFamily="monospace"
                  textShadow="0 2px 4px rgba(0,0,0,0.8)"
                  fontSize="md"
                  letterSpacing="0.02em"
                >
                  {step.title}
                </Text>
                <Text
                  color="rgba(255,255,255,0.85)"
                  fontSize="sm"
                  lineHeight="1.8"
                  fontFamily="monospace"
                  textShadow="0 1px 2px rgba(0,0,0,0.6)"
                >
                  {step.desc}
                </Text>
              </VStack>
            </Box>
          </List.Item>
        ))}
      </List.Root>
    </Box>
  );
}

