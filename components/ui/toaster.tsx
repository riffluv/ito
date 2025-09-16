"use client";
import {
  Box,
  Toaster as ChakraToaster,
  Toast,
  createToaster,
} from "@chakra-ui/react";

// Chakra UI v3 official toaster instance.
// Keep placement centralized to avoid layout interference with app content.
export const toaster = createToaster({
  placement: "top-end", // 右上: 手札ドックやホストパネルと重ならない
  max: 3,
  overlap: false,
  gap: 12,
  // provide slight offsets from viewport edges
  offsets: { top: "16px", right: "16px", bottom: "16px", left: "16px" },
});

// Render Chakra's toaster using the canonical Toast composition without custom CSS.
// Keeping the default composition minimizes layout/style regressions.
export function Toaster() {
  return (
    <ChakraToaster toaster={toaster}>
      {(toast) => (
        <Toast.Root
          key={toast.id}
          px="3"
          py="2"
          borderRadius={0}
          borderWidth="thin"
          boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
          w="auto"
          minW={{ base: "240px", md: "280px" }}
          maxW={{ base: "calc(100vw - 32px)", md: "360px" }}
        >
          <Toast.Indicator mr="2" />
          <div>
            {toast.title ? <Toast.Title>{toast.title}</Toast.Title> : null}
            {toast.description ? (
              <Toast.Description>
                <Box whiteSpace="normal" wordBreak="break-word">
                  {toast.description}
                </Box>
              </Toast.Description>
            ) : null}
          </div>
          <Toast.CloseTrigger />
        </Toast.Root>
      )}
    </ChakraToaster>
  );
}
