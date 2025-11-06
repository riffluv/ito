"use client";

import type { ReactNode } from "react";
import { Box } from "@chakra-ui/react";

type HandAreaSectionProps = {
  hostPanel?: ReactNode;
  spectatorNotice?: ReactNode;
  handNode?: ReactNode;
};

export function HandAreaSection({
  hostPanel,
  spectatorNotice,
  handNode,
}: HandAreaSectionProps) {
  const hasSpectatorUi = Boolean(hostPanel || spectatorNotice);
  return (
    <Box
      display="flex"
      flexDirection="column"
      gap={hasSpectatorUi ? 4 : 0}
    >
      {hostPanel}
      {spectatorNotice}
      {handNode ?? (hasSpectatorUi ? null : <Box h="1px" />)}
    </Box>
  );
}
