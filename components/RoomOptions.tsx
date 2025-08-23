"use client";
import { AppButton } from "@/components/ui/AppButton";
import type { RoomOptions } from "@/lib/types";
import { Field, HStack, Stack } from "@chakra-ui/react";

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

      {/* クリア方式は '順番に出す' のみをサポートする（'並べ替えで一括判定' を廃止） */}
      <Field.Root>
        <Field.Label>クリア方式</Field.Label>
        <HStack>
          <AppButton
            size="sm"
            variant="solid"
            onClick={() => onChange({ ...value, resolveMode: "sequential" })}
            disabled={disabled}
          >
            順番に出す（従来）
          </AppButton>
        </HStack>
      </Field.Root>
    </Stack>
  );
}
