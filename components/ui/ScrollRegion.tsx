"use client";
import { Box } from "@chakra-ui/react";
import { ComponentProps, ReactNode, forwardRef } from "react";

/**
 * ScrollRegion: 縦スクロール領域の標準化
 * - momentum scroll, overscroll contain, container-type 付与オプション
 * - role/aria-label を透過
 */
export interface ScrollRegionProps
  extends Omit<ComponentProps<typeof Box>, "children"> {
  children: ReactNode;
  withContainer?: boolean; // container queries 用 inline-size container
}

export const ScrollRegion = forwardRef<HTMLDivElement, ScrollRegionProps>(
  function ScrollRegion(
    { children, withContainer, ...rest }: ScrollRegionProps,
    ref
  ) {
    return (
      <Box
        ref={ref}
        overflowY="auto"
        minH={0}
        css={{
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          ...(withContainer ? { containerType: "inline-size" } : null),
        }}
        {...rest}
      >
        {children}
      </Box>
    );
  }
);

export default ScrollRegion;
