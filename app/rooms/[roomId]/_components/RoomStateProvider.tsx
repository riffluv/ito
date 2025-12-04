"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useRoomState } from "@/lib/hooks/useRoomState";

export type RoomStateSnapshot = ReturnType<typeof useRoomState>;

const RoomStateContext = createContext<RoomStateSnapshot | null>(null);

type RoomStateProviderProps = {
  roomId: string;
  uid: string | null;
  displayName?: string | null;
  passwordVerified: boolean;
  children: ReactNode;
};

export function RoomStateProvider({
  roomId,
  uid,
  displayName,
  passwordVerified,
  children,
}: RoomStateProviderProps) {
  const roomState = useRoomState(
    roomId,
    uid,
    passwordVerified ? displayName ?? null : null
  );

  return (
    <RoomStateContext.Provider value={roomState}>
      {children}
    </RoomStateContext.Provider>
  );
}

export function useRoomStateContext(): RoomStateSnapshot {
  const ctx = useContext(RoomStateContext);
  if (!ctx) {
    throw new Error("useRoomStateContext must be used within RoomStateProvider");
  }
  return ctx;
}
