"use client";

import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { Box, Heading, List, Text, VStack } from "@chakra-ui/react";

const KEY_RULES = [
  "▶ 自分の数字をそのまま言ってはいけません。",
  "▶ 他のプレイヤーと協力して順序を推理し合います。",
  "▶ 失敗した場合でも、残りのプレイヤーは最後までカードを出して遊べます（デフォルト仕様）。",
] as const;

const TIPS = [
  "▶ テーマに対して分かりやすい具体例を選ぶ（抽象的すぎない）。",
  "▶ 小さい数字は「身近で安価なもの」、大きい数字は「大きい/高価/壮大なもの」を表現すると伝わりやすい。",
  "▶ 表現の比喩は文化差が出るので、参加者の共通認識を確認すると良い。",
] as const;

export function RulesTipsSection() {
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
        攻略のポイント
      </Heading>

      <VStack
        gap={{ base: scaleForDpi("2.1rem"), md: scaleForDpi("2.7rem") }}
        align="stretch"
      >
        <Box>
          <Text
            fontWeight="bold"
            color="white"
            mb={scaleForDpi("1.1rem")}
            fontFamily="monospace"
            textShadow="2px 2px 0px #000"
            fontSize={{
              base: scaleForDpi("1.17rem"),
              md: scaleForDpi("1.3rem"),
            }}
            letterSpacing="0.051em"
          >
            ルール（要点）
          </Text>
          <List.Root as="ul" gap="2" style={{ listStyleType: "none" }}>
            {KEY_RULES.map((rule, index) => (
              <List.Item key={index}>
                <Text
                  color="white"
                  fontSize="sm"
                  fontFamily="monospace"
                  textShadow="1px 1px 0px #000"
                >
                  {rule}
                </Text>
              </List.Item>
            ))}
          </List.Root>
        </Box>

        <Box>
          <Text
            fontWeight="bold"
            color="white"
            mb={scaleForDpi("1.1rem")}
            fontFamily="monospace"
            textShadow="2px 2px 0px #000"
            fontSize={{
              base: scaleForDpi("1.17rem"),
              md: scaleForDpi("1.3rem"),
            }}
            letterSpacing="0.051em"
          >
            コツ
          </Text>
          <List.Root as="ul" gap="2" style={{ listStyleType: "none" }}>
            {TIPS.map((tip, index) => (
              <List.Item key={index}>
                <Text
                  color="white"
                  fontSize="sm"
                  fontFamily="monospace"
                  textShadow="1px 1px 0px #000"
                >
                  {tip}
                </Text>
              </List.Item>
            ))}
          </List.Root>
        </Box>

        <Box>
          <Text
            fontWeight="bold"
            color="white"
            mb={scaleForDpi("1.1rem")}
            fontFamily="monospace"
            textShadow="2px 2px 0px #000"
            fontSize={{
              base: scaleForDpi("1.17rem"),
              md: scaleForDpi("1.3rem"),
            }}
            letterSpacing="0.051em"
          >
            例
          </Text>
          <Box
            p={4}
            borderRadius={0}
            border="borders.retrogame"
            borderColor="whiteAlpha.80"
            bg="bgSubtle"
            boxShadow="2px 2px 0 rgba(0,0,0,0.8), 3px 3px 0 rgba(0,0,0,0.6)"
          >
            <VStack align="start" gap={scaleForDpi("0.8rem")}>
              <Text
                color="white"
                fontSize={{ base: "sm", md: "md" }}
                lineHeight="1.7"
                fontFamily="monospace"
                textShadow="1px 1px 0px #000"
              >
                <Text
                  as="span"
                  fontWeight="bold"
                  color="rgba(251,191,36,0.9)"
                >
                  テーマ: ラスボスの風格を感じさせる攻撃手段
                </Text>
              </Text>
              <Text
                color="white"
                fontSize={{ base: "sm", md: "md" }}
                lineHeight="1.7"
                fontFamily="monospace"
                textShadow="1px 1px 0px #000"
              >
                カードが20の人: 「さすまた」「ヨーヨー」
              </Text>
              <Text
                color="white"
                fontSize={{ base: "sm", md: "md" }}
                lineHeight="1.7"
                fontFamily="monospace"
                textShadow="1px 1px 0px #000"
              >
                カードが80の人: 「メテオ」「聖なる槍」
              </Text>
            </VStack>
          </Box>
        </Box>

        {/* 早く始めるための簡易ルール セクションは要望により削除しました */}
      </VStack>
    </Box>
  );
}

