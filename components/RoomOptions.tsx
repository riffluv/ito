"use client";
import { AppButton } from "@/components/ui/AppButton";
import type { RoomOptions } from "@/lib/types";
import { Field, HStack, Stack, Text } from "@chakra-ui/react";

export function RoomOptionsEditor({
  value,
  onChange,
  disabled,
}: {
  value: RoomOptions;
  onChange: (v: RoomOptions) => void;
  disabled?: boolean;
}) {
  return (
    <Stack gap={3}>
      {/* allowContinueAfterFail オプションは廃止。ホスト操作で継続可否を制御します */}

      {/* '失敗後の動作' は continueMode を廃止し、allowContinueAfterFail のトグルで制御します */}

      <Field.Root>
        <Field.Label>クリア方式 (resolveMode)</Field.Label>
        <Stack gap={2}>
          <HStack wrap="wrap" gap={2}>
            <AppButton
              size="sm"
              variant={value.resolveMode === "sequential" ? "solid" : "outline"}
              onClick={() => onChange({ ...value, resolveMode: "sequential" })}
              disabled={disabled}
            >
              順番に出す
            </AppButton>
            <AppButton
              size="sm"
              variant={
                value.resolveMode === "sort-submit" ? "solid" : "outline"
              }
              onClick={() => onChange({ ...value, resolveMode: "sort-submit" })}
              disabled={disabled}
            >
              せーので出す
            </AppButton>
          </HStack>
          <Text fontSize="xs" color="fgMuted">
            {value.resolveMode === "sequential" &&
              "1枚ずつ出し、出すたびに昇順違反があれば失敗になります"}
            {value.resolveMode === "sort-submit" &&
              "全員が伏せたカード(数字非公開)を出し連想ワードで相談→ホストが一括判定"}
          </Text>
        </Stack>
      </Field.Root>
    </Stack>
  );
}
