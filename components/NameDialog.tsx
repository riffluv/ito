"use client";
import React from "react";
import { Dialog, Field, Input, Stack } from "@chakra-ui/react";
import { AppButton } from "@/components/ui/AppButton";

export function NameDialog({
  isOpen,
  defaultValue = "",
  onCancel,
  onSubmit,
  submitting = false,
}: {
  isOpen: boolean;
  defaultValue?: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
  submitting?: boolean;
}) {
  const [value, setValue] = React.useState(defaultValue);
  React.useEffect(() => setValue(defaultValue), [defaultValue]);
  return (
    <Dialog.Root open={isOpen} onOpenChange={(d) => !d.open && onCancel()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.CloseTrigger />
          <Dialog.Header>
            <Dialog.Title>プレイヤー名を入力</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Field.Root>
              <Field.Label>名前</Field.Label>
              <Input
                placeholder="例）たろう"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </Field.Root>
          </Dialog.Body>
          <Dialog.Footer>
            <AppButton variant="ghost" onClick={onCancel} mr={3}>
              キャンセル
            </AppButton>
            <AppButton
              colorPalette="orange"
              loading={submitting}
              onClick={() => onSubmit(value.trim())}
            >
              決定
            </AppButton>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

export default NameDialog;
