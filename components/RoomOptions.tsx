"use client";
import type { RoomOptions } from "@/lib/types";
import { Field, HStack, Switch, Stack } from "@chakra-ui/react";
import { AppButton } from "@/components/ui/AppButton";

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
      <HStack justify="space-between" w="100%">
        <Field.Root orientation="horizontal" w="100%">
          <Field.Label>失敗後に残りを公開</Field.Label>
          <Switch.Root
            checked={value.allowContinueAfterFail}
            onCheckedChange={(e) =>
              onChange({ ...value, allowContinueAfterFail: e.checked })
            }
            disabled={disabled}
          >
            <Switch.HiddenInput />
            <Switch.Control />
          </Switch.Root>
        </Field.Root>
      </HStack>

      <Field.Root>
        <Field.Label>クリア方式</Field.Label>
        <HStack>
          <AppButton
            size="sm"
            variant={value.resolveMode === "sort-submit" ? "ghost" : "solid"}
            onClick={() => onChange({ ...value, resolveMode: "sequential" })}
            disabled={disabled}
          >
            順番に出す（従来）
          </AppButton>
          <AppButton
            size="sm"
            variant={value.resolveMode === "sort-submit" ? "solid" : "ghost"}
            onClick={() => onChange({ ...value, resolveMode: "sort-submit" })}
            disabled={disabled}
          >
            並べ替えで一括判定
          </AppButton>
        </HStack>
      </Field.Root>
    </Stack>
  );
}
