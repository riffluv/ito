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
      borderRadius={0}
      p={{ base: 3, md: 4 }}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="surfaceOverlay"
      borderWidth="1px"
      borderColor="borderDefault"
      boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
      // ガラス効果除去
    >
      <Button
        fontSize="17px"
        onClick={onConfirm}
        borderRadius={0}
        fontWeight={700}
        px={8}
        bg="accent"
        color="white"
        _hover={{
          bg: "accentHover",
          boxShadow: "3px 3px 0 rgba(0,0,0,0.8), 6px 6px 0 rgba(0,0,0,0.6)",
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
