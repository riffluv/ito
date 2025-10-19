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

const scaleForDpi = (value: string) => `calc(${value} * var(--dpi-scale))`;

export default function RulesPage() {
  const router = useRouter();
  const transition = useTransition();
  return (
    <Box
      minH="100dvh"
      bg="richBlack.900" // ドラクエ風リッチブラック背景
      position="relative"
    >
      <Container
        maxW="4xl"
        py={{ base: scaleForDpi("5.3rem"), md: scaleForDpi("6.1rem") }}
        position="relative"
      >
        {/* Hero Header */}
        <VStack
          mb={{ base: scaleForDpi("4.2rem"), md: scaleForDpi("5.3rem") }}
          align="stretch"
          gap={scaleForDpi("3.2rem")}
        >
          <Flex
            justify="space-between"
            align="center"
            wrap="wrap"
            gap={scaleForDpi("1.1rem")}
          >
            <AppButton
              onClick={async () => {
                try {
                  await transition.navigateWithTransition(
                    "/",
                    {
                      direction: "fade",
                      duration: 0.83,
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
            <Box
              border="2px solid rgba(255,255,255,0.9)"
              borderRadius={0}
              px={3}
              py={1}
              bg="rgba(12,14,20,0.7)"
              css={{
                boxShadow: "1px 1px 0 rgba(0,0,0,0.8), 2px 2px 0 rgba(0,0,0,0.6)"
              }}
            >
              <HStack gap={scaleForDpi("0.4rem")}>
                <BookOpen
                  size={14}
                  color="rgba(255,255,255,0.95)"
                />
                <Text
                  fontSize="sm"
                  fontWeight={700}
                  color="rgba(255,255,255,0.95)"
                  fontFamily="monospace"
                  textShadow="1px 1px 0px #000"
                >
                  ゲームルール
                </Text>
              </HStack>
            </Box>
          </Flex>

          <VStack align="start" gap={scaleForDpi("1.6rem")}>
            <Heading
              size="4xl"
              fontWeight="bold"
              color="rgba(255,255,255,0.95)"
              fontFamily="monospace"
              textShadow="0 2px 4px rgba(0,0,0,0.8), 0 0 12px rgba(255,215,0,0.2)"
              letterSpacing="0.083em"
              textAlign="center"
              mb={scaleForDpi("1.1rem")}
              pb={scaleForDpi("0.8rem")}
              css={{
                borderBottom: "2px solid rgba(255,255,255,0.2)",
              }}
            >
              序の紋章III のきまり
            </Heading>
            <HStack
              align="center"
              gap={scaleForDpi("2.1rem")}
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
                p={scaleForDpi("1.6rem")}
                bg="bgPanel"
                border="borders.retrogame"
                borderColor="whiteAlpha.90"
                borderRadius={0}
                boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
                flex={1}
                minW={{ base: "100%", md: "0" }}
              >
                <Text
                  fontSize={{
                    base: scaleForDpi("1.05rem"),
                    md: scaleForDpi("1.17rem"),
                  }}
                  color="whiteAlpha.95"
                  fontFamily="monospace"
                  lineHeight="1.73"
                  textAlign="center"
                  textShadow="1px 1px 2px rgba(0,0,0,0.8)"
                  letterSpacing="0.31px"
                >
                  協力型のパーティーゲーム。
                  <br />
                  各プレイヤーは 1〜100の 数字を持ち、
                  <br />
                  自分の数字を直接言わずに
                  <br />
                  「お題」に沿った表現で伝え、
                  <br />
                  全員でカードを小さい順に
                  <br />
                  並べることを目指します。
                </Text>
              </Box>
            </HStack>
          </VStack>
        </VStack>

        <VStack
          gap={{ base: scaleForDpi("2.7rem"), md: scaleForDpi("3.2rem") }}
          align="stretch"
        >
          {/* ゲームの流れ */}
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
              {[
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
              ].map((step, index) => (
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
                      transform: `translateY(-${index % 2 === 0 ? '2.3' : '3.1'}px)`,
                      boxShadow: "3px 3px 0 rgba(0,0,0,0.8), 0 6px 16px rgba(0,0,0,0.6)",
                      borderColor: "whiteAlpha.75",
                    }}
                    css={{
                      background: "linear-gradient(135deg, rgba(18,20,28,0.85) 0%, rgba(12,14,20,0.9) 100%)",
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

          {/* 判定方法（モード） */}
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
                      <Text as="span" fontWeight="bold" color="rgba(251,191,36,0.9)">
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
                    duration: 0.83,
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
