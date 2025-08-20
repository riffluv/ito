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
          <Toast.Root {...rest}>
            <Toast.Indicator />
            {title ? <Toast.Title>{title as any}</Toast.Title> : null}
            {description ? (
              <Toast.Description>{description as any}</Toast.Description>
            ) : null}
            <Toast.CloseTrigger />
          </Toast.Root>
        );
      }}
    </ChakraToaster>
  );
}
