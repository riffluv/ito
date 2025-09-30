"use client";

import { AppButton } from "@/components/ui/AppButton";
import {
  Badge,
  Box,
  Container,
  Flex,
  Heading,
  HStack,
  Image,
  List,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ArrowLeft, BookOpen } from "lucide-react";

import { useRouter } from "next/navigation";
import { useTransition } from "@/components/ui/TransitionProvider";

export default function RulesPage() {
  const router = useRouter();
  const transition = useTransition();
  return (
    <Box
      minH="100dvh"
      bg="richBlack.900" // ドラクエ風リッチブラック背景
      position="relative"
    >
      <Container maxW="4xl" py={{ base: 20, md: 24 }} position="relative">
        {/* Hero Header */}
        <VStack mb={{ base: 16, md: 20 }} align="stretch" gap={12}>
          <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
            <AppButton
              onClick={async () => {
                try {
                  await transition.navigateWithTransition(
                    "/",
                    {
                      direction: "fade",
                      duration: 0.8,
                      showLoading: true,
                      loadingSteps: [
                        { id: "return", message: "メインメニューに もどっています...", duration: 1000 },
                      ],
                    }
                  );
                } catch (error) {
                  console.error("Main menu navigation failed:", error);
                  router.push("/");
                }
              }}
              visual="solid"
              palette="brand"
              size="lg"
            >
              <ArrowLeft size={20} style={{ marginRight: "8px" }} />
              メインメニューに戻る
            </AppButton>
            <Badge
              colorScheme="blue"
              borderRadius={0}
              px={3}
              py={1}
              fontSize="sm"
              fontWeight="medium"
            >
              <BookOpen
                size={14}
                style={{ marginRight: "6px", display: "inline" }}
              />
              ゲームルール
            </Badge>
          </Flex>

          <VStack align="start" gap={6}>
            <Heading
              size="4xl"
              fontWeight="bold"
              color="rgba(255,255,255,0.95)"
              fontFamily="monospace"
              textShadow="0 2px 4px rgba(0,0,0,0.8), 0 0 12px rgba(255,215,0,0.2)"
              letterSpacing="0.08em"
              textAlign="center"
              mb={4}
              pb={3}
              css={{
                borderBottom: "2px solid rgba(255,255,255,0.2)",
              }}
            >
              序の紋章III の きまり
            </Heading>
            <HStack
              align="center"
              gap={8}
              flexWrap={{ base: "wrap", md: "nowrap" }}
              justify={{ base: "center", md: "center" }}
              w="100%"
            >
              {/* カード画像 */}
              <Box
                flex="0 0 auto"
                display="flex"
                justifyContent="center"
                alignItems="center"
                w={{ base: "120px", md: "150px", lg: "170px" }}
                mx="auto"
              >
                <Image
                  src="/images/card3.webp"
                  alt="ゲームカード"
                  width={{ base: "100px", md: "130px", lg: "150px" }}
                  height={{ base: "100px", md: "130px", lg: "150px" }}
                  style={{
                    imageRendering: "pixelated",
                    filter: "drop-shadow(0 8px 25px rgba(0,0,0,0.9))",
                    transform: "translateZ(0)",
                  }}
                />
              </Box>

              {/* テキストボックス */}
              <Box
                p={6}
                bg="bgPanel"
                border="borders.retrogame"
                borderColor="whiteAlpha.90"
                borderRadius={0}
                boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
                flex={1}
                minW={{ base: "100%", md: "0" }}
              >
                <Text
                  fontSize={{ base: "md", md: "lg" }}
                  color="whiteAlpha.95"
                  fontFamily="monospace"
                  lineHeight="1.7"
                  textAlign="center"
                  textShadow="1px 1px 2px rgba(0,0,0,0.8)"
                  letterSpacing="0.3px"
                >
                  きょうりょくがたの パーティーゲーム。
                  <br />
                  かくプレイヤーは 1〜100の かずを もち、
                  <br />
                  じぶんの かずを ちょくせつ いわずに
                  <br />
                  「おだい」に そった ひょうげんで つたえ、
                  <br />
                  ぜんいんで カードを ちいさい じゅんに
                  <br />
                  ならべることを めざします。
                </Text>
              </Box>
            </HStack>
          </VStack>
        </VStack>

        <VStack gap={{ base: 10, md: 12 }} align="stretch">
          {/* ゲームの流れ */}
          <Box
            bg="bgPanel"
            border="borders.retrogame"
            borderColor="whiteAlpha.90"
            borderRadius={0}
            boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
            p={{ base: 6, md: 8 }}
          >
            <Heading
              size="lg"
              color="rgba(255,255,255,0.95)"
              fontFamily="monospace"
              textShadow="0 2px 4px rgba(0,0,0,0.8)"
              textAlign="center"
              mb={6}
              pb={3}
              css={{
                borderBottom: "2px solid rgba(255,255,255,0.15)",
              }}
            >
              ゲームの ながれ
            </Heading>

            <List.Root
              as="ol"
              gap="3"
              style={{ listStyleType: "none", paddingLeft: 0, marginLeft: 0 }}
            >
              {[
                {
                  title: "▶ １．カード くばり",
                  desc: "かくプレイヤーに １〜１００の カードを １まいずつ くばります。じぶんの すうじは ほかの プレイヤーに おしえては いけません。",
                },
                {
                  title: "▶ ２．おだいを きめる",
                  desc: "１まいの おだいカードを ひいて テーマを きめます（れい：「こわいもの」「すきな たべもの」など）。すうじの だいしょうを ひょうげんしやすい テーマが よいです。",
                },
                {
                  title: "▶ ３．ひょうげん（ヒント）",
                  desc: "かくプレイヤーは じぶんの すうじを ちょくせつ いわず、テーマに そった「たとえ」や「イメージ」で ひょうげんします。",
                },
                {
                  title: "▶ ４．カードを だす",
                  desc: "ひょうげんを きいて、じぶんの カードが ちいさいと おもう じゅんに カードを ばに だして いきます。",
                },
                {
                  title: "▶ ５．はんてい",
                  desc: "すべての カードを ばに だし、ちいさい じゅんに ならんで いれば せいこう です。じゅんじょが いれかわって いたら しっぱい です。",
                },
              ].map((step, index) => (
                <List.Item key={index}>
                  <Box
                    p={5}
                    mb={4}
                    border="borders.retrogameThin"
                    borderColor="whiteAlpha.60"
                    borderRadius={0}
                    boxShadow="2px 2px 0 rgba(0,0,0,0.8), 0 4px 12px rgba(0,0,0,0.4)"
                    transition="all 0.2s ease"
                    _hover={{
                      transform: "translateY(-2px)",
                      boxShadow: "3px 3px 0 rgba(0,0,0,0.8), 0 6px 16px rgba(0,0,0,0.6)",
                      borderColor: "whiteAlpha.75",
                    }}
                    css={{
                      background: "linear-gradient(135deg, rgba(18,20,28,0.85) 0%, rgba(12,14,20,0.9) 100%)",
                    }}
                  >
                    <VStack align="start" gap={2} flex={1}>
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

          {/* 判定方法（モード） */}
          <Box
            bg="bgPanel"
            border="borders.retrogame"
            borderColor="whiteAlpha.90"
            borderRadius={0}
            boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
            p={{ base: 6, md: 8 }}
          >
            <Heading
              size="lg"
              color="rgba(255,255,255,0.95)"
              fontFamily="monospace"
              textShadow="0 2px 4px rgba(0,0,0,0.8)"
              textAlign="center"
              mb={6}
              pb={3}
              css={{
                borderBottom: "2px solid rgba(255,255,255,0.15)",
              }}
            >
              Online版の とくちょう
            </Heading>

            <List.Root as="ul" gap="4" style={{ listStyleType: "none" }}>
              {[
                {
                  title: "▶ リアルタイム協力",
                  desc: "全員が連想ワード（ヒント）だけを出し合います。全員分のカードが揃ったら、ドラッグ＆ドロップで並び順を共同編集し、ホストの判定で結果が公開されます。",
                },
                {
                  title: "▶ 基本ルール",
                  desc: "数字そのものを直接口にすることは禁止。ヒントの抽象度や範囲感を揃えて協力しましょう。",
                },
              ].map((mode, index) => (
                <List.Item key={index}>
                  <Box
                    p={4}
                    borderRadius={0}
                    border="borders.retrogameThin"
                    borderColor="whiteAlpha.60"
                    bg="bgSubtle"
                    boxShadow="1px 1px 0 rgba(0,0,0,0.6)"
                  >
                    <Text fontWeight="bold" color="white" mb={2} fontFamily="monospace" textShadow="1px 1px 0px #000">
                      {mode.title}
                    </Text>
                    <Text color="white" fontSize="sm" lineHeight="1.6" fontFamily="monospace" textShadow="1px 1px 0px #000">
                      {mode.desc}
                    </Text>
                  </Box>
                </List.Item>
              ))}
            </List.Root>
          </Box>

          {/* ルール要点・コツ・例 */}
          <Box
            bg="bgPanel"
            border="borders.retrogame"
            borderColor="whiteAlpha.90"
            borderRadius={0}
            boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
            p={{ base: 6, md: 8 }}
          >
            <Heading
              size="lg"
              color="rgba(255,255,255,0.95)"
              fontFamily="monospace"
              textShadow="0 2px 4px rgba(0,0,0,0.8)"
              textAlign="center"
              mb={6}
              pb={3}
              css={{
                borderBottom: "2px solid rgba(255,255,255,0.15)",
              }}
            >
              こうりゃくの ポイント
            </Heading>

            <VStack gap={{ base: 8, md: 10 }} align="stretch">
              <Box>
                <Text
                  fontWeight="bold"
                  color="white"
                  mb={4}
                  fontFamily="monospace"
                  textShadow="2px 2px 0px #000"
                  fontSize={{ base: "lg", md: "xl" }}
                  letterSpacing="0.05em"
                >
                  ルール（要点）
                </Text>
                <List.Root as="ul" gap="2" style={{ listStyleType: "none" }}>
                  {[
                    "▶ 自分の数字をそのまま言ってはいけません。",
                    "▶ 他のプレイヤーと協力して順序を推理し合います。",
                    "▶ 失敗した場合でも、残りのプレイヤーは最後までカードを出して遊べます（デフォルト仕様）。",
                  ].map((rule, index) => (
                    <List.Item key={index}>
                      <Text color="white" fontSize="sm" fontFamily="monospace" textShadow="1px 1px 0px #000">
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
                  mb={4}
                  fontFamily="monospace"
                  textShadow="2px 2px 0px #000"
                  fontSize={{ base: "lg", md: "xl" }}
                  letterSpacing="0.05em"
                >
                  コツ
                </Text>
                <List.Root as="ul" gap="2" style={{ listStyleType: "none" }}>
                  {[
                    "▶ テーマに対して分かりやすい具体例を選ぶ（抽象的すぎない）。",
                    "▶ 小さい数字は「身近で安価なもの」、大きい数字は「大きい/高価/壮大なもの」を表現すると伝わりやすい。",
                    "▶ 表現の比喩は文化差が出るので、参加者の共通認識を確認すると良い。",
                  ].map((tip, index) => (
                    <List.Item key={index}>
                      <Text color="white" fontSize="sm" fontFamily="monospace" textShadow="1px 1px 0px #000">
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
                  mb={4}
                  fontFamily="monospace"
                  textShadow="2px 2px 0px #000"
                  fontSize={{ base: "lg", md: "xl" }}
                  letterSpacing="0.05em"
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
                  <VStack align="start" gap={3}>
                    <Text
                      color="white"
                      fontSize={{ base: "sm", md: "md" }}
                      lineHeight="1.7"
                      fontFamily="monospace"
                      textShadow="1px 1px 0px #000"
                    >
                      <Text as="span" fontWeight="bold" color="yellow.300">
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
        </VStack>

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
          <AppButton
            onClick={async () => {
              try {
                await transition.navigateWithTransition(
                  "/",
                  {
                    direction: "fade",
                    duration: 0.8,
                    showLoading: true,
                    loadingSteps: [
                      { id: "return", message: "メインメニューに もどっています...", duration: 1000 },
                    ],
                  }
                );
              } catch (error) {
                console.error("Main menu navigation failed:", error);
                router.push("/");
              }
            }}
            visual="solid"
            palette="brand"
            size="lg"
          >
            <ArrowLeft size={20} style={{ marginRight: "8px" }} />
            メインメニューに戻る
          </AppButton>
        </VStack>
      </Container>
    </Box>
  );
}
