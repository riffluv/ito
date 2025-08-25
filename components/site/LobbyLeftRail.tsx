"use client";
import { AppButton } from "@/components/ui/AppButton";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Field, Input, Stack, Switch, Text } from "@chakra-ui/react";

type Props = {
  search: string;
  onSearch: (v: string) => void;
  waitingOnly: boolean;
  onToggleWaiting: (v: boolean) => void;
  onCreate: () => void;
};

export default function LobbyLeftRail({
  search,
  onSearch,
  waitingOnly,
  onToggleWaiting,
  onCreate,
}: Props) {
  return (
    <Box as="aside" position="sticky" top="80px">
      <Box
        borderWidth={UNIFIED_LAYOUT.BORDER_WIDTH}
        rounded="xl"
        p={4}
        bg="panelBg"
      >
        <Text fontWeight="bold" mb={2}>
          クイックアクション
        </Text>
        <AppButton
          colorPalette="orange"
          w="full"
          onClick={onCreate}
          minW="unset"
        >
          新しい部屋を作る
        </AppButton>
      </Box>

      <Box
        borderWidth={UNIFIED_LAYOUT.BORDER_WIDTH}
        rounded="xl"
        p={4}
        mt={4}
        bg="panelBg"
      >
        <Text fontWeight="bold" mb={2}>
          ルームフィルター
        </Text>
        <Stack gap={3}>
          <Field.Root>
            <Field.Label>キーワード検索</Field.Label>
            <Input
              placeholder="部屋名で検索"
              size="sm"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </Field.Root>
          <Field.Root orientation="horizontal">
            <Field.Label mb="0">待機中のみ表示</Field.Label>
            <Switch.Root
              checked={waitingOnly}
              onCheckedChange={(d) => onToggleWaiting(d.checked)}
            >
              <Switch.HiddenInput />
              <Switch.Control />
            </Switch.Root>
          </Field.Root>
        </Stack>
      </Box>
    </Box>
  );
}
