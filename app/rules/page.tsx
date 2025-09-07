import { RPGButton } from "@/components/ui/RPGButton";
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

export default function RulesPage() {
  return (
    <Box
      minH="100vh"
      bg="richBlack.900" // ドラクエ風リッチブラック背景
      position="relative"
    >
      <Container maxW="4xl" py={{ base: 12, md: 16 }} position="relative">
        {/* Hero Header */}
        <VStack mb={{ base: 8, md: 12 }} align="stretch" gap={6}>
          <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
            <RPGButton
              href="/"
              variant="subtle"
              size="md"
              borderRadius="lg"
              style={{
                paddingLeft: "12px",
                paddingRight: "16px",
              }}
            >
              <ArrowLeft size={16} style={{ marginRight: "8px" }} />
              トップへ戻る
            </RPGButton>
            <Badge
              colorScheme="blue"
              borderRadius="lg"
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

          <VStack align="start" gap={4}>
            <Heading
              size="4xl"
              fontWeight="bold"
              color="white"
              fontFamily="monospace"
              textShadow="2px 2px 0px #000"
              letterSpacing="0.1em"
              textAlign="center"
              mb={4}
            >
              ▼ 序の紋章III の きまり ▼
            </Heading>
            <HStack align="start" gap={8} flexWrap={{ base: "wrap", md: "nowrap" }} justify="center">
              {/* カード画像 */}
              <Box flex="0 0 auto" display="flex" justifyContent="center">
                <Image
                  src="/images/card2.png"
                  alt="ゲームカード"
                  width={{ base: "140px", md: "180px", lg: "220px" }}
                  height={{ base: "140px", md: "180px", lg: "220px" }}
                  style={{
                    imageRendering: "pixelated",
                    filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.8))"
                  }}
                />
              </Box>
              
              {/* テキストボックス */}
              <Box
                p={6}
                bg="richBlack.800"
                border="borders.retrogame"
                borderRadius={0}
                flex={1}
                minW={{ base: "100%", md: "0" }}
              >
                <Text
                  fontSize={{ base: "md", md: "lg" }}
                  color="white"
                  fontFamily="monospace"
                  lineHeight="1.8"
                  textAlign={{ base: "center", md: "left" }}
                  textShadow="1px 1px 0px #000"
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

        <VStack gap={{ base: 8, md: 10 }} align="stretch">
          {/* ゲームの流れ */}
          <Box
            bg="richBlack.800"
            border="borders.retrogame"
            borderRadius={0}
            p={{ base: 6, md: 8 }}
          >
            <Heading
              size="lg"
              color="white"
              fontFamily="monospace"
              textShadow="1px 1px 0px #000"
              textAlign="center"
              mb={6}
              borderBottom="borders.retrogameThin"
              pb={4}
            >
              ▼ ゲームの ながれ ▼
            </Heading>

            <List.Root
              as="ol"
              gap="3"
              style={{ listStyleType: "none", paddingLeft: 0, marginLeft: 0 }}
            >
              {[
                {
                  title: "１．カード くばり",
                  desc: "かくプレイヤーに １〜１００の カードを １まいずつ くばります。じぶんの すうじは ほかの プレイヤーに おしえては いけません。",
                },
                {
                  title: "２．おだいを きめる",
                  desc: "１まいの おだいカードを ひいて テーマを きめます（れい：「こわいもの」「すきな たべもの」など）。すうじの だいしょうを ひょうげんしやすい テーマが よいです。",
                },
                {
                  title: "３．ひょうげん（ヒント）",
                  desc: "かくプレイヤーは じぶんの すうじを ちょくせつ いわず、テーマに そった「たとえ」や「イメージ」で ひょうげんします。",
                },
                {
                  title: "４．カードを だす",
                  desc: "ひょうげんを きいて、じぶんの カードが ちいさいと おもう じゅんに カードを ばに だして いきます。",
                },
                {
                  title: "５．はんてい",
                  desc: "すべての カードを ばに だし、ちいさい じゅんに ならんで いれば せいこう です。じゅんじょが いれかわって いたら しっぱい です。",
                },
              ].map((step, index) => (
                <List.Item key={index}>
                  <Box
                    p={4}
                    mb={3}
                    bg="richBlack.700"
                    border="borders.retrogameThin"
                    borderRadius={0}
                  >
                    <VStack align="start" gap={2} flex={1}>
                      <Text
                        fontWeight="bold"
                        color="white"
                        fontFamily="monospace"
                        textShadow="1px 1px 0px #000"
                        fontSize="md"
                      >
                        {step.title}
                      </Text>
                      <Text
                        color="white"
                        fontSize="sm"
                        lineHeight="1.6"
                        fontFamily="monospace"
                        textShadow="1px 1px 0px #000"
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
            bg="richBlack.800"
            border="borders.retrogame"
            borderRadius={0}
            p={{ base: 6, md: 8 }}
          >
            <Heading
              size="lg"
              color="white"
              fontFamily="monospace"
              textShadow="1px 1px 0px #000"
              textAlign="center"
              mb={6}
              borderBottom="borders.retrogameThin"
              pb={4}
            >
              ▼ はんてい ほうほう（モード）▼
            </Heading>

            <List.Root as="ul" gap="4">
              {[
                {
                  title: "順次モード（準備中）",
                  desc: "このモードは現在準備中のためご利用いただけません。今は一括モードがデフォルトで動作しています。",
                },
                {
                  title: "一括モード",
                  desc: "現在のデフォルト動作です。全員が連想ワード（ヒント）だけを出し合います。全員分のカードが揃ったら、ドラッグ＆ドロップで並び順を共同編集し、ホストの判定で結果が公開されます。",
                },
                {
                  title: "共通ルール",
                  desc: "数字そのものを直接口にすることは禁止。ヒントの抽象度や範囲感を揃えて協力しましょう。",
                },
              ].map((mode, index) => (
                <List.Item key={index}>
                  <Box
                    p={4}
                    borderRadius="lg"
                    border="1px solid rgba(255,255,255,0.1)"
                    bg="rgba(255,255,255,0.02)"
                  >
                    <Text fontWeight="semibold" color="white" mb={2}>
                      {mode.title}
                    </Text>
                    <Text color="gray.300" fontSize="sm" lineHeight="relaxed">
                      {mode.desc}
                    </Text>
                  </Box>
                </List.Item>
              ))}
            </List.Root>
          </Box>

          {/* ルール要点・コツ・例 */}
          <Box
            bg="richBlack.800"
            border="borders.retrogame"
            borderRadius={0}
            p={{ base: 6, md: 8 }}
          >
            <Heading
              size="lg"
              color="white"
              fontFamily="monospace"
              textShadow="1px 1px 0px #000"
              textAlign="center"
              mb={6}
              borderBottom="borders.retrogameThin"
              pb={4}
            >
              ▼ こうりゃくの ポイント ▼
            </Heading>

            <VStack gap={6} align="stretch">
              <Box>
                <Text fontWeight="semibold" color="white" mb={3}>
                  ルール（要点）
                </Text>
                <List.Root as="ul" gap="2">
                  {[
                    "自分の数字をそのまま言ってはいけません。",
                    "他のプレイヤーと協力して順序を推理し合います。",
                    "失敗した場合でも、残りのプレイヤーは最後までカードを出して遊べます（デフォルト仕様）。",
                  ].map((rule, index) => (
                    <List.Item key={index}>
                      <Text color="gray.300" fontSize="sm">
                        {rule}
                      </Text>
                    </List.Item>
                  ))}
                </List.Root>
              </Box>

              <Box>
                <Text fontWeight="semibold" color="white" mb={3}>
                  コツ
                </Text>
                <List.Root as="ul" gap="2">
                  {[
                    "テーマに対して分かりやすい具体例を選ぶ（抽象的すぎない）。",
                    "小さい数字は「身近で安価なもの」、大きい数字は「大きい/高価/壮大なもの」を表現すると伝わりやすい。",
                    "表現の比喩は文化差が出るので、参加者の共通認識を確認すると良い。",
                  ].map((tip, index) => (
                    <List.Item key={index}>
                      <Text color="gray.300" fontSize="sm">
                        {tip}
                      </Text>
                    </List.Item>
                  ))}
                </List.Root>
              </Box>

              <Box>
                <Text fontWeight="semibold" color="white" mb={3}>
                  例
                </Text>
                <Box
                  p={4}
                  borderRadius="lg"
                  border="1px solid rgba(255,255,255,0.1)"
                  bg="rgba(107,115,255,0.1)"
                >
                  <VStack align="start" gap={1}>
                    <Text color="gray.200" fontSize="sm" lineHeight="relaxed">
                      <Text as="span" fontWeight="semibold">
                        テーマ: ラスボスの風格を感じさせる攻撃手段
                      </Text>
                    </Text>
                    <Text color="gray.200" fontSize="sm" lineHeight="relaxed">
                      カードが20の人: 「さすまた」「ヨーヨー」
                    </Text>
                    <Text color="gray.200" fontSize="sm" lineHeight="relaxed">
                      カードが80の人: 「メテオ」「聖なる槍」
                    </Text>
                  </VStack>
                </Box>
              </Box>

              {/* 早く始めるための簡易ルール セクションは要望により削除しました */}
            </VStack>
          </Box>
        </VStack>

        <Box mt={{ base: 10, md: 12 }} textAlign="center">
          <Box
            p={4}
            bg="richBlack.700"
            border="borders.retrogameThin"
            borderRadius={0}
            mx="auto"
            maxW="2xl"
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
        </Box>
      </Container>
    </Box>
  );
}
