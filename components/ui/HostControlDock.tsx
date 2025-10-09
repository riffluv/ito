"use client";

import { useHostActions } from "@/components/hooks/useHostActions";
import { useHostAutoStartLock } from "@/components/hooks/useHostAutoStartLock";
import { AppButton } from "@/components/ui/AppButton";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { Box, HStack } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { AdvancedHostPanelProps } from "./AdvancedHostPanel";

const mapVariant = (variant?: string) => {
  switch (variant) {
    case "link":
    case "soft":
      return "ghost" as const;
    case "outline":
    case "solid":
    case "ghost":
    case "subtle":
      return variant;
    default:
      return "outline" as const;
  }
};

const AdvancedHostPanel = dynamic<AdvancedHostPanelProps>(
  () => import("./AdvancedHostPanel"),
  { ssr: false, loading: () => null }
);

const hostVeil = keyframes`
  0% { transform: translateX(-5px); opacity: 0.66; }
  50% { transform: translateX(3px); opacity: 0.82; }
  100% { transform: translateX(-4px); opacity: 0.68; }
`;

const hostPulse = keyframes`
  0% { box-shadow: 0 0 0 rgba(120, 140, 210, 0.16); }
  40% { box-shadow: 0 0 14px rgba(160, 180, 255, 0.22); }
  100% { box-shadow: 0 0 0 rgba(120, 140, 210, 0.16); }
`;

interface HostControlDockProps {
  roomId: string;
  room: RoomDoc & { id?: string };
  players: (PlayerDoc & { id: string })[];
  onlineCount?: number;
  hostPrimaryAction?: {
    label: string;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
    title?: string;
  } | null;
}

export default function HostControlDock({
  roomId,
  room,
  players,
  onlineCount,
  hostPrimaryAction,
}: HostControlDockProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  
  const {
    autoStartLocked,
    beginLock: beginAutoStartLock,
    clearLock: clearAutoStartLock,
  } = useHostAutoStartLock(roomId, room?.status);
  
  const autoStartControl = useMemo(() => ({
    locked: autoStartLocked,
    begin: beginAutoStartLock,
    clear: clearAutoStartLock,
  }), [autoStartLocked, beginAutoStartLock, clearAutoStartLock]);
  
  const hostActions = useHostActions({
    room,
    players,
    roomId,
    hostPrimaryAction,
    onlineCount,
    autoStartControl,
  });

  const displayActions = useMemo(
    () =>
      hostActions.map((action) => {
        if (action.key === "advancedMode") {
          return {
            ...action,
            onClick: () => setIsAdvancedOpen(true),
          };
        }
        return action;
      }),
    [hostActions, setIsAdvancedOpen]
  );

  return (
    <>
      <Box
        position="relative"
        css={{
          pointerEvents: "auto",
          isolation: "isolate",
          '&::before': {
            content: "''",
            position: "absolute",
            inset: "-14px -18px",
            background: 'linear-gradient(137deg, rgba(32, 48, 92, 0.38) 0%, rgba(18, 26, 48, 0.12) 65%, rgba(12, 14, 20, 0) 100%)',
            borderRadius: "16px",
            filter: 'blur(22px)',
            opacity: 0.85,
            animation: `${hostVeil} 14.2s ease-in-out infinite`,
            pointerEvents: 'none',
          },
          '&::after': {
            content: "''",
            position: "absolute",
            inset: "-10px -14px",
            borderRadius: "14px",
            border: "1px solid rgba(120, 140, 210, 0.22)",
            opacity: 0.6,
            animation: `${hostPulse} 9.6s cubic-bezier(0.36, 0.12, 0.25, 1) infinite`,
            pointerEvents: 'none',
          },
          '@media (prefers-reduced-motion: reduce)': {
            '&::before': { animation: 'none', opacity: 0.35 },
            '&::after': { animation: 'none', opacity: 0.25 },
          },
        }}
      >
        <HStack gap={2}>
          {displayActions.map((action) => (
            <AppButton
              key={action.key}
              onClick={action.onClick}
              disabled={action.disabled || Boolean(action.busy)}
              aria-busy={action.busy ? "true" : undefined}
              title={action.title}
              colorPalette={action.palette}
              variant={mapVariant(action.variant)}
              size="sm"
            >
              {action.label}
            </AppButton>
          ))}
        </HStack>
      </Box>

      {isAdvancedOpen ? (
        <AdvancedHostPanel
          isOpen={isAdvancedOpen}
          onClose={() => setIsAdvancedOpen(false)}
          roomId={roomId}
          room={room}
          players={players}
          onlineCount={onlineCount || players.length}
        />
      ) : null}
    </>
  );
}
