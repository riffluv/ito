"use client";

import { AppButton } from "@/components/ui/AppButton";
import { Box } from "@chakra-ui/react";
import React from "react";
import {
  MINI_HAND_DOCK_FLOATING_CENTER_BOTTOM,
  orangeGlowNext,
} from "../miniHandDockStyles";
import { SEINO_BUTTON_STYLES } from "../seinoButtonStyles";

type NextGameButtonProps = {
  onClick: () => void | Promise<unknown>;
  disabled: boolean;
};

export function NextGameButton(props: NextGameButtonProps) {
  const { onClick, disabled } = props;

  return (
    <Box
      position="fixed"
      bottom={MINI_HAND_DOCK_FLOATING_CENTER_BOTTOM}
      left="50%"
      transform="translateX(-50%)"
      zIndex={55}
    >
      <AppButton
        {...SEINO_BUTTON_STYLES}
        size="lg"
        visual="solid"
        muteClickSound
        onClick={() => void onClick()}
        disabled={disabled}
        css={{
          animation: `${orangeGlowNext} 3.8s cubic-bezier(.38,.18,.62,.82) infinite`,
        }}
      >
        次のゲーム
      </AppButton>
    </Box>
  );
}
