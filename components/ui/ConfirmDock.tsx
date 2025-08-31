"use client";
import React from "react";
import { Box, Button } from "@chakra-ui/react";
import { DOCK_BOTTOM_MOBILE, DOCK_BOTTOM_DESKTOP } from "@/lib/ui/layout";

export default function ConfirmDock({
  onConfirm,
  label = "確定！順番を発表",
}: {
  onConfirm: () => void | Promise<void>;
  label?: string;
}) {
  return (
    <Box
      position="fixed"
      left={{ base: 3, md: 6 }}
      right={{ base: 3, md: 6 }}
      bottom={{ base: DOCK_BOTTOM_MOBILE, md: DOCK_BOTTOM_DESKTOP }}
      zIndex={22}
      borderRadius="20px"
      p={{ base: 3, md: 4 }}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bgGradient="panelWood"
      borderWidth="2px"
      borderColor="woodBorder"
      css={{ backdropFilter: "blur(15px)", boxShadow: "var(--shadows-panelWood)" }}
    >
      <Button
        size="lg"
        onClick={onConfirm}
        css={{
          background:
            "linear-gradient(135deg, rgba(139,115,85,0.9), rgba(160,133,91,0.9))",
          color: "rgba(0,0,0,0.9)",
          border: "1px solid rgba(160,133,91,0.8)",
          boxShadow:
            "0 6px 18px rgba(139,115,85,0.45), inset 0 1px 0 rgba(255,255,255,0.35)",
          paddingInline: "1.5rem",
        }}
      >
        {label}
      </Button>
    </Box>
  );
}
