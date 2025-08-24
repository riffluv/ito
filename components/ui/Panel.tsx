"use client";
import { Box, Heading, chakra, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface PanelProps
  extends Omit<React.ComponentProps<typeof Box>, "title"> {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  density?: "comfortable" | "compact";
  variant?: "surface" | "subtle" | "outlined" | "accent";
  elevated?: boolean;
}

export function Panel(props: PanelProps) {
  const {
    title,
    actions,
    children,
    density = "comfortable",
    variant = "surface",
    elevated = false,
    ...rest
  } = props;
  const panelRecipe = useSlotRecipe({ key: "panel" });
  const styles = panelRecipe({ density, variant, elevated });

  return (
    <Box css={styles.container} {...rest}>
      {(title || actions) && (
        <Box css={styles.header}>
          {title ? (
            <Heading as={chakra.h3} css={styles.title}>
              {title}
            </Heading>
          ) : (
            <span />
          )}
          {actions && <Box css={styles.actions}>{actions}</Box>}
        </Box>
      )}
      <Box css={styles.body}>{children}</Box>
    </Box>
  );
}
