import type { ReactNode } from "react";

import type { PlayerDoc, RoomDoc } from "@/lib/types";

export type RoomViewProps = {
  roomId: string;
  room: RoomDoc & { id: string };
  nodes: {
    header: ReactNode | undefined;
    sidebar: ReactNode;
    main: ReactNode;
    handArea: ReactNode;
  };
  overlays: {
    joinStatusBanner: ReactNode;
    safeUpdateBannerNode: ReactNode;
    versionMismatchOverlay: ReactNode;
  };
  dealRecoveryOpen: boolean;
  onDealRecoveryDismiss: () => void;
  needName: boolean;
  onSubmitName: (name: string) => void | Promise<void>;
  simplePhase: {
    status: string;
    canStartSorting: boolean;
    topic: string | null;
  };
  chat: {
    players: (PlayerDoc & { id: string })[];
    hostId: string | null;
    isFinished: boolean;
    onOpenLedger: () => void;
    ledgerLabel?: string;
    canOpenLedger?: boolean;
  };
  passwordDialog: {
    isOpen: boolean;
    roomName?: string;
    isLoading: boolean;
    error: string | null;
    onSubmit: (input: string) => Promise<void> | void;
    onCancel: () => void;
  };
  settings: {
    isOpen: boolean;
    onClose: () => void;
    options: RoomDoc["options"];
    isHost: boolean;
    roomStatus: string;
  };
  ledger: {
    isOpen: boolean;
    onClose: () => void;
    players: (PlayerDoc & { id: string })[];
    orderList: string[];
    topic: string | null;
    failed: boolean;
    roomId: string;
    myId: string;
    mvpVotes: Record<string, string> | null;
    stats: RoomDoc["stats"] | null;
    readOnly?: boolean;
    contextLabel?: string | null;
  };
  me: (PlayerDoc & { id: string }) | null;
  isSpectatorMode: boolean;
  meHasPlacedCard: boolean;
  showNotifyBridge?: boolean;
};
