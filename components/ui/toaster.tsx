"use client";
import {
  Toaster as ChakraToaster,
  Toast,
  createToaster,
} from "@chakra-ui/react";

// v3: Export a singleton toaster and a renderer component
export const toaster = createToaster({ placement: "top-end" });

export function Toaster() {
  return (
    <ChakraToaster toaster={toaster}>
      {(toast) => {
        const { title, description, ...rest } = toast as any;
        return (
          <Toast.Root
            {...rest}
            style={{
              minWidth: 280,
              maxWidth: 420,
              width: "max-content",
              alignItems: "flex-start",
            }}
          >
            <Toast.Indicator />
            <div style={{ display: "grid", gap: 2 }}>
              {title ? (
                <Toast.Title style={{ wordBreak: "break-word" }}>
                  {title as any}
                </Toast.Title>
              ) : null}
              {description ? (
                <Toast.Description style={{ whiteSpace: "pre-line", wordBreak: "break-word" }}>
                  {description as any}
                </Toast.Description>
              ) : null}
            </div>
            <Toast.CloseTrigger />
          </Toast.Root>
        );
      }}
    </ChakraToaster>
  );
}
