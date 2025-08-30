"use client";
import { Box, BoxProps } from "@chakra-ui/react";

export interface CenteredProps extends Omit<BoxProps, "children"> {
  children: React.ReactNode;
  maxWToken?: string; // default: var(--board-max-width) と同等
  px?: number | string;   // Chakra spacing token（例: 2, 3, 4）
}

/**
 * 横幅を中央に揃えるための小さなヘルパー。
 * maxWidth / mx:auto / px を一カ所で統一。
 */
export default function Centered({ children, maxWToken, px, ...rest }: CenteredProps) {
  return (
    <Box
      width="100%"
      maxWidth={maxWToken ?? "var(--board-max-width)"}
      marginInline="auto"
      paddingInline={px ?? 3}
      css={{ containerType: "inline-size" }}
      {...rest}
    >
      {children}
    </Box>
  );
}
