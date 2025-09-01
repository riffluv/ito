"use client";
import { DOCK_BOTTOM_DESKTOP, DOCK_BOTTOM_MOBILE } from "@/lib/ui/layout";
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
      bottom={{ base: DOCK_BOTTOM_MOBILE, md: DOCK_BOTTOM_DESKTOP }}
      zIndex={22}
      rounded="xl"
      p={{ base: 3, md: 4 }}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="surfaceOverlay"
      borderWidth="1px"
      borderColor="borderDefault"
      shadow="md"
      backdropFilter="blur(12px)"
    >
      <Button
        size="lg"
        onClick={onConfirm}
        rounded="lg"
        fontWeight={700}
        px={8}
        bg="accent"
        color="white"
        _hover={{
          bg: "accentHover",
          shadow: "lg",
          transform: "translateY(-2px)",
        }}
        _active={{ bg: "accentActive", transform: "translateY(-1px)" }}
        transition="background-color .25s, box-shadow .25s, transform .25s"
      >
        {label}
      </Button>
    </Box>
  );
}
