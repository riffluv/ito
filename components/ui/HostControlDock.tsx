"use client";

import { useHostActions } from "@/components/hooks/useHostActions";
import { useHostAutoStartLock } from "@/components/hooks/useHostAutoStartLock";
import { AppButton } from "@/components/ui/AppButton";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { HStack } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { AdvancedHostPanel } from "./AdvancedHostPanel";

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

  // Filter out advancedMode action since we handle it separately
  // Map to valid AppButton variants
  const mapVariant = (variant?: string) => {
    switch (variant) {
      case "link":
      case "soft":
        return "ghost";
      case "outline":
      case "solid":
      case "ghost":
      case "subtle":
        return variant;
      default:
        return "outline";
    }
  };

  const displayActions = hostActions.map((action) => {
    if (action.key === "advancedMode") {
      return {
        ...action,
        onClick: () => setIsAdvancedOpen(true),
      };
    }
    return action;
  });

  return (
    <>
      <HStack gap={2}>
        {displayActions.map((action) => (
          <AppButton
            key={action.key}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.title}
            colorPalette={action.palette}
            variant={mapVariant(action.variant)}
            size="sm"
          >
            {action.label}
          </AppButton>
        ))}
      </HStack>

      <AdvancedHostPanel
        isOpen={isAdvancedOpen}
        onClose={() => setIsAdvancedOpen(false)}
        roomId={roomId}
        room={room}
        players={players}
        onlineCount={onlineCount || players.length}
      />
    </>
  );
}