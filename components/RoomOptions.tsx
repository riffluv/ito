"use client";
import { FormControl, FormLabel, HStack, Switch } from "@chakra-ui/react";
import type { RoomOptions } from "@/lib/types";

export function RoomOptionsEditor({ value, onChange, disabled }: {
  value: RoomOptions;
  onChange: (v: RoomOptions) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <HStack justify="space-between">
        <FormControl display="flex" alignItems="center" w="100%">
          <FormLabel mb="0">失敗後継続</FormLabel>
          <Switch isChecked={value.allowContinueAfterFail} onChange={(e) => onChange({ ...value, allowContinueAfterFail: e.target.checked })} isDisabled={disabled} />
        </FormControl>
      </HStack>
    </>
  );
}
