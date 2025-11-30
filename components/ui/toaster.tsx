"use client";
import {
  Box,
  Toaster as ChakraToaster,
  Toast,
  createToaster,
} from "@chakra-ui/react";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import type { Options as ToastOptions, StatusChangeDetails } from "@zag-js/toast";

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

type AnimatedToast = ToastOptions<ReactNode>;

// Octopath Traveler-style GSAP toast animations
function ToastWithAnimation({ toast }: { toast: AnimatedToast }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const el = rootRef.current;
      if (!el) return;
      gsap.fromTo(
        el,
        {
          x: 60,
          opacity: 0,
          scale: 1.05,
        },
        {
          x: 0,
          opacity: 1,
          scale: 1,
          duration: 0.45,
          ease: "power2.out",
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  // HD-2D exit animation when toast is removed
  useEffect(() => {
    const originalCallback = toast.onStatusChange;
    const ctx = gsap.context(() => {}, rootRef);

    toast.onStatusChange = (details: StatusChangeDetails) => {
      if (details.status === "unmounted" && rootRef.current) {
        ctx.add(() => {
          gsap.to(rootRef.current, {
            y: -20,
            opacity: 0,
            duration: 0.3,
            ease: "power2.in",
          });
        });
      }
      originalCallback?.(details);
    };

    return () => {
      toast.onStatusChange = originalCallback;
      ctx.revert();
    };
  }, [toast]);

  return (
    <Toast.Root
      ref={rootRef}
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
  );
}

// Render Chakra's toaster with GSAP-powered HD-2D animations
export function Toaster() {
  return (
    <ChakraToaster toaster={toaster}>
      {(toast) => <ToastWithAnimation toast={toast} />}
    </ChakraToaster>
  );
}
