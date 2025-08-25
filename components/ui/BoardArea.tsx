"use client";
import { Box, BoxProps } from "@chakra-ui/react";

export type BoardAreaProps = BoxProps & {
  isOver?: boolean;
};

export default function BoardArea({
  isOver,
  children,
  ...rest
}: BoardAreaProps) {
  return (
    <Box position="relative">
      <Box
        role="region"
        aria-label="カード配置エリア"
        position="relative"
        minH="300px" /* TODO: 統一システムに移行 */
        borderWidth="2px"
        borderStyle="dashed"
        borderColor={isOver ? "accent" : "whiteAlpha.200"}
        rounded="lg"
        p={4}
        display="flex"
        gap={4}
        alignItems="center"
        flexWrap="wrap"
        justifyContent="center" // 単数枚時も中央に配置
        perspective="{sizes.perspectiveCard}" // flip variant の立体歪みを軽減 (token)
        css={{
          "& .gamecard-inner": {
            transformStyle: "preserve-3d",
          },
        }}
        bg={
          isOver
            ? "rgba(78,205,196,0.04)"
            : "repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0, rgba(255,255,255,0.02) 8px, transparent 8px, transparent 16px)"
        }
        transition="all 150ms ease"
        {...rest}
      >
        {children}
      </Box>
    </Box>
  );
}
