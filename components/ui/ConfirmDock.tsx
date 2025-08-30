"use client";
import React from "react";
import { Box, Button } from "@chakra-ui/react";

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
      bottom={{ base: "120px", md: "144px" }}
      zIndex={22}
      borderRadius="20px"
      p={{ base: 3, md: 4 }}
      display="flex"
      alignItems="center"
      justifyContent="center"
      css={{
        background:
          "linear-gradient(180deg, rgba(101,67,33,0.8) 0%, rgba(80,53,26,0.9) 100%)",
        border: "2px solid rgba(160,133,91,0.6)",
        backdropFilter: "blur(15px)",
        boxShadow: "0 8px 25px rgba(0,0,0,0.7), inset 0 2px 0 rgba(160,133,91,0.3)",
      }}
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

