"use client"
import { Box, List, Text } from "@chakra-ui/react"

export function PhaseTips({ phase }: { phase: string }) {
  if (phase === "clue") {
    return (
      <Box color="fgMuted">
        <Text fontWeight="semibold" mb={2}>
          表現のコツ
        </Text>
        <List.Root gap="1.5">
          <List.Item>数字は言わない（推測の余地を残す）</List.Item>
          <List.Item>お題の大小が伝わる軸で例える</List.Item>
          <List.Item>極端な例は高低の目安として有効</List.Item>
          <List.Item>他人の表現と相対比較して更新する</List.Item>
        </List.Root>
      </Box>
    )
  }
  if (phase === "playing") {
    return (
      <Box color="fgMuted">
        <Text fontWeight="semibold" mb={2}>
          並べるときの指針
        </Text>
        <List.Root gap="1.5">
          <List.Item>自分が「より小さい/大きい」と確信できる順に</List.Item>
          <List.Item>迷ったら一旦保留、他の情報を待つ</List.Item>
          <List.Item>直前のカードと比較した“差”を意識</List.Item>
        </List.Root>
      </Box>
    )
  }
  if (phase === "waiting") {
    return (
      <Box color="fgMuted">
        <Text>ホストが開始すると配布→お題→表現フェーズに進みます。</Text>
      </Box>
    )
  }
  return null
}

export default PhaseTips

