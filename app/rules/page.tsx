import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Heading, Text, HStack, List } from "@chakra-ui/react";
import { AppButton } from "@/components/ui/AppButton";

export const metadata: Metadata = {
  title: "ITO ルール | Online ITO",
  description: "協力型パーティゲーム ITO（イト）の簡潔なルール説明",
};

export default function RulesPage() {
  return (
    <Container maxW="4xl" py={{ base: 8, md: 12 }}>
      <HStack justify="space-between" mb={{ base: 4, md: 6 }}>
        <Heading size="2xl" letterSpacing="tight">
          ITO（イト） — ルール（簡潔版）
        </Heading>
        <AppButton as={Link} href="/" variant="subtle">
          トップへ戻る
        </AppButton>
      </HStack>

      <Text color="fgMuted" mb={{ base: 6, md: 8 }}>
        ITO は協力型のパーティゲームです。各プレイヤーは 1〜100 の数字が書かれたカードを 1 枚ずつ持ち、自分の数字を直接言わずに「お題」に沿った表現で数字の大小を伝え、全員でカードを小さい順に並べることを目指します。
      </Text>

      <Heading size="lg" mb={3}>ゲームの流れ</Heading>
      <List.Root as="ol" gap="2" mb={{ base: 6, md: 8 }}>
        <List.Item>
          カード配布 — 各プレイヤーに 1〜100 のカードを 1 枚ずつ配ります。自分の数字は他のプレイヤーに教えないでください。
        </List.Item>
        <List.Item>
          お題を決める — 1 枚のお題カードを引いてテーマを決めます（例: 「怖いもの」「好きな食べ物」など）。数字の大小を表現しやすいテーマが良いです。
        </List.Item>
        <List.Item>
          表現（ヒント） — 各プレイヤーは自分の数字を直接言わず、テーマに沿った「たとえ」や「イメージ」で表現します。
        </List.Item>
        <List.Item>
          カードを出す — 表現を聞いて、自分のカードが小さいと思う順にカードを場に出していきます。
        </List.Item>
        <List.Item>
          判定 — 全てのカードを場に出し、小さい順に並んでいれば成功です。順序が入れ替わっていたら失敗です。
        </List.Item>
      </List.Root>

      <Heading size="lg" mb={3}>判定方法（モード）</Heading>
      <List.Root as="ul" gap="2" mb={{ base: 6, md: 8 }}>
        <List.Item>
          通常モード（逐次判定 / sequential）: 各プレイヤーが「自分が次に小さい」と思ったタイミングで 1 枚ずつカードをドラッグして場に出し、その都度 昇順かどうかを即時判定します。途中で順序違反が起きてもゲームは最後まで続行できます（失敗表示は出る）。
        </List.Item>
        <List.Item>
          せーので出すモード（一括判定 / sort-submit）: 全員が連想ワード（ヒント）だけを出し合い、数字は最後まで伏せたままにします。全員分のカードが揃ったら、ドラッグ＆ドロップで並び順を共同編集。ホストが「せーので判定」を押すと数字が順に公開され、すべて昇順なら成功です。
        </List.Item>
        <List.Item>
          共通ルール: 数字そのものを直接口にすることは禁止。ヒントの抽象度や範囲感を揃えて協力しましょう。
        </List.Item>
      </List.Root>

      <Heading size="lg" mb={3}>ルール（要点）</Heading>
      <List.Root as="ul" gap="2" mb={{ base: 6, md: 8 }}>
        <List.Item>自分の数字をそのまま言ってはいけません。</List.Item>
        <List.Item>他のプレイヤーと協力して順序を推理し合います。</List.Item>
        <List.Item>失敗した場合でも、残りのプレイヤーは最後までカードを出して遊べます（デフォルト仕様）。</List.Item>
      </List.Root>

      <Heading size="lg" mb={3}>コツ</Heading>
      <List.Root as="ul" gap="2" mb={{ base: 6, md: 8 }}>
        <List.Item>テーマに対して分かりやすい具体例を選ぶ（抽象的すぎない）。</List.Item>
        <List.Item>小さい数字は「身近で安価なもの」、大きい数字は「大きい/高価/壮大なもの」を表現すると伝わりやすい。</List.Item>
        <List.Item>表現の比喩は文化差が出るので、参加者の共通認識を確認すると良い。</List.Item>
      </List.Root>

      <Heading size="lg" mb={3}>例</Heading>
      <List.Root as="ul" gap="2" mb={{ base: 6, md: 8 }}>
        <List.Item>
          テーマ: 好きな食べ物 — カードが 20 の人: 「おにぎり」「ポテトチップス」 / カードが 80 の人: 「誕生日ケーキ」「高級レストランのコース」
        </List.Item>
      </List.Root>

      <Heading size="lg" mb={3}>早く始めるための簡易ルール</Heading>
      <List.Root as="ul" gap="2">
        <List.Item>プレイ人数が多いときは、カードのレンジ（たとえば 1〜50）を狭めても良い。</List.Item>
        <List.Item>時間制限を設けてテンポを上げる（例: 表現 30 秒、出す順を決める 60 秒）。</List.Item>
      </List.Root>

      <Box mt={{ base: 8, md: 12 }} fontSize="sm" color="fgMuted">
        （このページは簡潔な説明です。詳細やバリアントは別ページで管理可能です）
      </Box>
    </Container>
  );
}
