"use client";
import { FormControl, FormLabel, HStack, NumberInput, NumberInputField, Switch } from "@chakra-ui/react";
import type { RoomOptions } from "@/lib/types";

export function RoomOptionsEditor({ value, onChange, disabled }: {
  value: RoomOptions;
  onChange: (v: RoomOptions) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <HStack justify="space-between">
        <FormControl display="flex" alignItems="center">
          <FormLabel mb="0">追加ヒント</FormLabel>
          <Switch
            isChecked={value.allowSecondClue}
            onChange={(e) => onChange({ ...value, allowSecondClue: e.target.checked })}
            isDisabled={disabled}
          />
        </FormControl>
      </HStack>
      <HStack justify="space-between">
        <FormControl maxW="48%">
          <FormLabel>パス上限</FormLabel>
          <NumberInput value={value.passLimit} min={0} max={5} onChange={(_, n) => onChange({ ...value, passLimit: isNaN(n) ? value.passLimit : n })} isDisabled={disabled}>
            <NumberInputField />
          </NumberInput>
        </FormControl>
        <FormControl display="flex" alignItems="center" maxW="48%">
          <FormLabel mb="0">失敗後継続</FormLabel>
          <Switch isChecked={value.allowContinueAfterFail} onChange={(e) => onChange({ ...value, allowContinueAfterFail: e.target.checked })} isDisabled={disabled} />
        </FormControl>
      </HStack>
    </>
  );
}

