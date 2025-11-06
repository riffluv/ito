import type { Timestamp } from "firebase/firestore";

export type SpectatorSessionStatus =
  | "idle"
  | "inviting"
  | "invitationRejected"
  | "watching"
  | "rejoinPending"
  | "rejoinApproved"
  | "rejoinRejected"
  | "ended";

export type SpectatorSessionMode = "private" | "public";

export type SpectatorRejoinSource = "manual" | "auto";

export type SpectatorRejoinSnapshot =
  | { status: "pending"; source: SpectatorRejoinSource; createdAt: number | null }
  | { status: "accepted"; source: SpectatorRejoinSource; createdAt: number | null }
  | { status: "rejected"; source: SpectatorRejoinSource; createdAt: number | null; reason?: string | null }
  | null;

export type SpectatorSessionFlags = {
  ticketRequired?: boolean;
  inviteOnly?: boolean;
  [key: string]: unknown;
};

export type SpectatorSessionTelemetry = {
  joinLatencyMs?: number;
  lastHeartbeatAt?: number;
};

export interface SpectatorSessionRecord {
  roomId: string;
  viewerUid: string | null;
  inviteId: string | null;
  status: SpectatorSessionStatus;
  mode: SpectatorSessionMode;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  rejoinRequest?: {
    source: SpectatorRejoinSource;
    createdAt: Timestamp | null;
    reason?: string | null;
  };
  flags?: SpectatorSessionFlags;
  telemetry?: SpectatorSessionTelemetry;
}

export interface SpectatorInviteRecord {
  roomId: string;
  issuerUid: string;
  createdAt: Timestamp;
  expiresAt?: Timestamp | null;
  mode: SpectatorSessionMode;
  maxUses?: number | null;
  usedCount?: number;
}

export interface SpectatorSessionContext {
  roomId: string | null;
  sessionId: string | null;
  viewerUid: string | null;
  inviteId: string | null;
  status: SpectatorSessionStatus;
  mode: SpectatorSessionMode | null;
  error: string | null;
  rejoinSnapshot: SpectatorRejoinSnapshot;
  flags: SpectatorSessionFlags;
  telemetry: SpectatorSessionTelemetry;
  pendingInviteId: string | null;
}

export type SpectatorSessionEvent =
  | { type: "SESSION_INIT"; roomId: string; viewerUid: string | null }
  | { type: "INVITE_CONSUME"; inviteId: string }
  | {
      type: "INVITE_CONSUME_SUCCESS";
      result: { sessionId: string; mode: SpectatorSessionMode; inviteId: string | null; flags?: SpectatorSessionFlags };
    }
  | { type: "INVITE_CONSUME_FAILURE"; error?: unknown; reason?: string | null }
  | {
      type: "done.invoke.consumeInvite";
      data: { sessionId: string; mode: SpectatorSessionMode; inviteId: string | null; flags?: SpectatorSessionFlags };
    }
  | { type: "error.platform.consumeInvite"; data: unknown }
  | { type: "error.actor.consumeInvite"; data: unknown }
  | { type: "REQUEST_REJOIN"; source: SpectatorRejoinSource }
  | { type: "REJOIN_SNAPSHOT"; snapshot: SpectatorRejoinSnapshot }
  | { type: "REJOIN_ACCEPTED" }
  | { type: "REJOIN_REJECTED"; reason?: string | null }
  | { type: "SESSION_END"; reason?: string | null }
  | { type: "SESSION_ERROR"; error: unknown }
  | { type: "RESET" };

export interface SpectatorSessionServices {
  consumeInvite: (params: { inviteId: string; roomId: string; viewerUid?: string | null }) => Promise<{
    sessionId: string;
    mode: SpectatorSessionMode;
    inviteId: string | null;
  }>;
  startWatching: (params: { sessionId: string; roomId: string }) => Promise<void>;
  requestRejoin: (params: { sessionId: string; roomId: string; source: SpectatorRejoinSource }) => Promise<void>;
  cancelRejoin: (params: { sessionId: string; roomId: string }) => Promise<void>;
  endSession: (params: { sessionId: string; roomId: string; reason?: string | null }) => Promise<void>;
  observeRejoinSnapshot: (params: {
    sessionId: string;
    roomId: string;
    onSnapshot: (snapshot: SpectatorRejoinSnapshot) => void;
    onError: (error: unknown) => void;
  }) => () => void;
  approveRejoin: (params: { sessionId: string; roomId: string }) => Promise<void>;
  rejectRejoin: (params: { sessionId: string; roomId: string; reason?: string | null }) => Promise<void>;
}

export interface SpectatorSessionOptions {
  services?: Partial<SpectatorSessionServices>;
  manualInviteResolution?: boolean;
  manualRejoinObservation?: boolean;
}
