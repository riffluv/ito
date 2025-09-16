import { Tooltip as ChakraTooltip, Portal } from "@chakra-ui/react";
import * as React from "react";
import { UI_TOKENS } from "@/theme/layout";

export interface TooltipProps
  extends React.ComponentProps<typeof ChakraTooltip.Root> {
  content: React.ReactNode;
  showArrow?: boolean;
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement>;
  contentProps?: any;
  disabled?: boolean;
}

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  function Tooltip(props, ref) {
    const {
      showArrow,
      children,
      disabled,
      portalled = true,
      content,
      contentProps,
      portalRef,
      ...rest
    } = props;

    if (disabled) return <>{children}</>;

    return (
      <ChakraTooltip.Root {...rest}>
        <ChakraTooltip.Trigger asChild>{children}</ChakraTooltip.Trigger>
        <Portal disabled={!portalled} container={portalRef}>
          <ChakraTooltip.Positioner>
            <ChakraTooltip.Content
              ref={ref}
              {...contentProps}
              css={{
                background: "rgba(20, 23, 34, 0.95)",
                border: `2px solid ${UI_TOKENS.COLORS.whiteAlpha80}`,
                borderRadius: 0,
                padding: "8px 12px",
                fontSize: "13px",
                fontWeight: "600",
                fontFamily: "monospace",
                color: "white",
                textShadow: "1px 1px 0px rgba(0,0,0,0.8)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.6)",
                backdropFilter: "blur(8px)",
                maxWidth: "200px",
                zIndex: 9999,
                ...contentProps?.css
              }}
            >
              {showArrow && (
                <ChakraTooltip.Arrow
                  css={{
                    "--arrow-size": "6px",
                    "--arrow-bg": "rgba(20, 23, 34, 0.95)",
                  }}
                >
                  <ChakraTooltip.ArrowTip
                    css={{
                      borderTopColor: UI_TOKENS.COLORS.whiteAlpha80,
                      borderWidth: "2px"
                    }}
                  />
                </ChakraTooltip.Arrow>
              )}
              {content}
            </ChakraTooltip.Content>
          </ChakraTooltip.Positioner>
        </Portal>
      </ChakraTooltip.Root>
    );
  }
);

export default Tooltip;
