"use client";
import type { RoomOptions } from "@/lib/types";
import { Field, HStack, Switch } from "@chakra-ui/react";

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
    <>
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
    </>
  );
}
