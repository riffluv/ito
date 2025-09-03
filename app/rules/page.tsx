import { AppButton } from "@/components/ui/AppButton";
import {
  Badge,
  Box,
  Container,
  Flex,
  Heading,
  List,
  Text,
  VStack,
} from "@chakra-ui/react";
import { ArrowLeft, BookOpen, Target, Users, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ITO ルール | Online ITO",
  description: "協力型パーティゲーム ITO（イト）の簡潔なルール説明",
};

export default function RulesPage() {
  return (
    <Box
      minH="100vh"
      bgGradient="linear(to-br, #191B21, #212329)"
      position="relative"
      _before={{
        content: '""',
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgGradient:
          "radial(ellipse at 50% 0%, rgba(107,115,255,0.15), transparent 50%)",
        pointerEvents: "none",
      }}
    >
      <Container maxW="4xl" py={{ base: 12, md: 16 }} position="relative">
        {/* Hero Header */}
        <VStack mb={{ base: 8, md: 12 }} align="stretch" gap={6}>
          <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
            <AppButton
              as={Link}
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
            </AppButton>
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
              bgGradient="linear(to-r, white, #E2E8F0)"
              bgClip="text"
              letterSpacing="tight"
            >
              ITO（イト）
            </Heading>
            <Text
              fontSize="xl"
              color="gray.300"
              maxW="2xl"
              lineHeight="relaxed"
            >
              協力型のパーティゲーム。各プレイヤーは1〜100の数字が書かれたカードを1枚ずつ持ち、
              自分の数字を直接言わずに「お題」に沿った表現で数字の大小を伝え、
              全員でカードを小さい順に並べることを目指します。
            </Text>
          </VStack>
        </VStack>

        <VStack gap={{ base: 8, md: 10 }} align="stretch">
          {/* ゲームの流れ */}
          <Box
            bg="rgba(255,255,255,0.03)"
            backdropFilter="blur(10px)"
            borderRadius="xl"
            border="1px solid rgba(255,255,255,0.1)"
            p={{ base: 6, md: 8 }}
          >
            <Flex align="center" gap={3} mb={6}>
              <Box p={2} borderRadius="lg" bg="blue.500" color="white">
                <Users size={20} />
              </Box>
              <Heading size="lg" color="white">
                ゲームの流れ
              </Heading>
            </Flex>

            <List.Root as="ol" gap="3">
              {[
                {
                  title: "カード配布",
                  desc: "各プレイヤーに1〜100のカードを1枚ずつ配ります。自分の数字は他のプレイヤーに教えないでください。",
                },
                {
                  title: "お題を決める",
                  desc: "1枚のお題カードを引いてテーマを決めます（例: 「怖いもの」「好きな食べ物」など）。数字の大小を表現しやすいテーマが良いです。",
                },
                {
                  title: "表現（ヒント）",
                  desc: "各プレイヤーは自分の数字を直接言わず、テーマに沿った「たとえ」や「イメージ」で表現します。",
                },
                {
                  title: "カードを出す",
                  desc: "表現を聞いて、自分のカードが小さいと思う順にカードを場に出していきます。",
                },
                {
                  title: "判定",
                  desc: "全てのカードを場に出し、小さい順に並んでいれば成功です。順序が入れ替わっていたら失敗です。",
                },
              ].map((step, index) => (
                <List.Item key={index}>
                  <Flex gap={4} align="start">
                    <Box
                      minW="8"
                      h="8"
                      borderRadius="full"
                      bg="gray.700"
                      color="white"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      fontSize="sm"
                      fontWeight="bold"
                      mt={1}
                    >
                      {index + 1}
                    </Box>
                    <VStack align="start" gap={1} flex={1}>
                      <Text fontWeight="semibold" color="white">
                        {step.title}
                      </Text>
                      <Text color="gray.300" fontSize="sm" lineHeight="relaxed">
                        {step.desc}
                      </Text>
                    </VStack>
                  </Flex>
                </List.Item>
              ))}
            </List.Root>
          </Box>

          {/* 判定方法（モード） */}
          <Box
            bg="rgba(255,255,255,0.03)"
            backdropFilter="blur(10px)"
            borderRadius="xl"
            border="1px solid rgba(255,255,255,0.1)"
            p={{ base: 6, md: 8 }}
          >
            <Flex align="center" gap={3} mb={6}>
              <Box p={2} borderRadius="lg" bg="purple.500" color="white">
                <Zap size={20} />
              </Box>
              <Heading size="lg" color="white">
                判定方法（モード）
              </Heading>
            </Flex>

            <List.Root as="ul" gap="4">
              {[
                {
                  title: "通常モード（逐次判定 / sequential）",
                  desc: "各プレイヤーが「自分が次に小さい」と思ったタイミングで1枚ずつカードをドラッグして場に出し、その都度昇順かどうかを即時判定します。途中で順序違反が起きてもゲームは最後まで続行できます（失敗表示は出る）。",
                },
                {
                  title: "せーので出すモード（一括判定 / sort-submit）",
                  desc: "全員が連想ワード（ヒント）だけを出し合い、数字は最後まで伏せたままにします。全員分のカードが揃ったら、ドラッグ＆ドロップで並び順を共同編集。ホストが「せーので判定」を押すと数字が順に公開され、すべて昇順なら成功です。",
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
            bg="rgba(255,255,255,0.03)"
            backdropFilter="blur(10px)"
            borderRadius="xl"
            border="1px solid rgba(255,255,255,0.1)"
            p={{ base: 6, md: 8 }}
          >
            <Flex align="center" gap={3} mb={6}>
              <Box p={2} borderRadius="lg" bg="green.500" color="white">
                <Target size={20} />
              </Box>
              <Heading size="lg" color="white">
                攻略のポイント
              </Heading>
            </Flex>

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
                  <Text color="gray.200" fontSize="sm" lineHeight="relaxed">
                    <Text as="span" fontWeight="semibold">
                      テーマ: 好きな食べ物
                    </Text>
                    <br />
                    カードが20の人: 「おにぎり」「ポテトチップス」
                    <br />
                    カードが80の人: 「誕生日ケーキ」「高級レストランのコース」
                  </Text>
                </Box>
              </Box>

              <Box>
                <Text fontWeight="semibold" color="white" mb={3}>
                  早く始めるための簡易ルール
                </Text>
                <List.Root as="ul" gap="2">
                  {[
                    "プレイ人数が多いときは、カードのレンジ（たとえば1〜50）を狭めても良い。",
                    "時間制限を設けてテンポを上げる（例: 表現30秒、出す順を決める60秒）。",
                  ].map((rule, index) => (
                    <List.Item key={index}>
                      <Text color="gray.300" fontSize="sm">
                        {rule}
                      </Text>
                    </List.Item>
                  ))}
                </List.Root>
              </Box>
            </VStack>
          </Box>
        </VStack>

        <Box mt={{ base: 10, md: 12 }} textAlign="center">
          <Text fontSize="sm" color="gray.500">
            このページは簡潔な説明です。詳細やバリアントは別ページで管理可能です
          </Text>
        </Box>
      </Container>
    </Box>
  );
}
