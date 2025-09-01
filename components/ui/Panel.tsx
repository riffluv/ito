"use client";
import { Box, Heading, chakra, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

// theme/index.ts の panel slot recipe から型を抽出
type PanelVariants = {
  density?: "comfortable" | "compact";
  variant?: "surface" | "subtle" | "outlined" | "accent";
  elevated?: boolean;
};

export interface PanelProps
  extends Omit<React.ComponentProps<typeof Box>, "title">,
    PanelVariants {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function Panel(props: PanelProps) {
  const {
    title,
    actions,
    children,
    density = "comfortable",
    variant = "surface",
    elevated = false,
    className,
    css: customCss,
    ...rest
  } = props;

  const panelRecipe = useSlotRecipe({ key: "panel" });
  const styles = panelRecipe({ density, variant, elevated });

  // classNameを結合してカスタマイズ可能に
  const combinedClassName = `panel ${className ?? ""}`.trim();

  // 🎮 PREMIUM PANEL ENHANCEMENT
  const override = customCss || {};

  return (
    <Box
      css={{
        ...styles.container,
        transition: "background-color .25s, box-shadow .25s, border-color .25s",
        ...override,
      }}
      className={combinedClassName}
      {...rest}
    >
      {(title || actions) && (
        <Box
          css={{
            ...styles.header,
            borderBottom: "1px solid",
            borderColor: "borderSubtle",
          }}
        >
          {title ? (
            <Heading
              as={chakra.h3}
              css={{
                ...styles.title,
                color: variant === "accent" ? "accent" : "fgDefault",
                fontWeight: 600,
                textShadow: "none",
              }}
            >
              {title}
            </Heading>
          ) : (
            <Box />
          )}
          {actions && <Box css={styles.actions}>{actions}</Box>}
        </Box>
      )}
      <Box
        css={{
          ...styles.body,
          color: "fgDefault",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
