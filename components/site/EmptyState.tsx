"use client";
import { AppCard } from "@/components/ui/AppCard";
import { AppButton } from "@/components/ui/AppButton";
import { Box, Stack, Text } from "@chakra-ui/react";
import { SearchX } from "lucide-react";

export default function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <AppCard textAlign="center">
      <Stack align="center" gap={4}>
        <Box color="fgMuted">
          <SearchX size={40} />
        </Box>
        <Text color="fgMuted">公開ルームがありません。最初の部屋を作りましょう！</Text>
        <AppButton visual="subtle" palette="orange" onClick={onCreate} minW="10rem">
          部屋を作成
        </AppButton>
      </Stack>
    </AppCard>
  );
}
