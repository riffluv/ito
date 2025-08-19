"use client";
import { Box, Heading, HStack } from "@chakra-ui/react";
import type { ReactNode } from "react";

export function Panel({ title, actions, children, p = 4, gap = 3, ...rest }: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  p?: number | string;
  gap?: number | string;
} & Omit<React.ComponentProps<typeof Box>, "title">) {
  return (
    <Box layerStyle="panel" p={p} {...rest}>
      {(title || actions) && (
        <HStack justify="space-between" mb={gap}>
          {title ? <Heading size="sm">{title}</Heading> : <span />}
          {actions}
        </HStack>
      )}
      {children}
    </Box>
  );
}
