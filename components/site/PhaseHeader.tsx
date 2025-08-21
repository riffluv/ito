"use client"
import { Box, HStack, Text } from "@chakra-ui/react"

export type Phase = "waiting" | "clue" | "playing" | "finished" | string

const steps: { key: Phase; label: string }[] = [
  { key: "waiting", label: "待機" },
  { key: "clue", label: "表現" },
  { key: "playing", label: "順番出し" },
  { key: "finished", label: "結果" },
]

export function PhaseHeader({ phase }: { phase: Phase }) {
  const activeIndex = Math.max(0, steps.findIndex((s) => s.key === phase))
  return (
    <HStack
      gap={3}
      align="center"
      px={{ base: 2, md: 0 }}
      py={2}
      aria-label="現在のゲームフェーズ"
      role="list"
    >
      {steps.map((s, i) => {
        const active = i === activeIndex
        const done = i < activeIndex
        return (
          <HStack key={s.key} gap={2} role="listitem">
            <Box
              boxSize={3}
              rounded="full"
              bg={active ? "brand.400" : done ? "green.400" : "borderDefault"}
              outline={active ? "2px solid var(--colors-brand-300)" : undefined}
            />
            <Text
              fontSize="sm"
              color={active ? "fgDefault" : "fgMuted"}
              minW="4.5em"
            >
              {s.label}
            </Text>
            {i < steps.length - 1 ? (
              <Box w={{ base: 6, md: 12 }} h="1px" bg="borderDefault" />
            ) : null}
          </HStack>
        )
      })}
    </HStack>
  )
}

export default PhaseHeader

