import { useEffect, useMemo } from "react";
import { useMachine } from "@xstate/react";

import {
  createSpectatorSessionMachine,
  type SpectatorSessionState,
} from "./sessionMachine";
import { spectatorV2Service } from "./service";
import type {
  SpectatorRejoinSource,
  SpectatorSessionContext,
  SpectatorSessionServices,
} from "./types";

export type UseSpectatorSessionOptions = {
  roomId: string | null | undefined;
  viewerUid?: string | null;
  services?: Partial<SpectatorSessionServices>;
  autoInit?: boolean;
  manualInviteResolution?: boolean;
  manualRejoinObservation?: boolean;
};

export type UseSpectatorSessionResult = {
  state: SpectatorSessionState;
  context: SpectatorSessionContext;
  status: SpectatorSessionContext["status"];
  sessionId: string | null;
  inviteId: string | null;
  mode: SpectatorSessionContext["mode"];
  error: string | null;
  rejoinSnapshot: SpectatorSessionContext["rejoinSnapshot"];
  actions: {
    consumeInvite: (inviteId: string) => void;
    requestRejoin: (source: SpectatorRejoinSource) => void;
    reset: () => void;
    approveRejoin: (sessionId: string) => Promise<void>;
    rejectRejoin: (sessionId: string, reason?: string | null) => Promise<void>;
  };
  is: {
    idle: boolean;
    ready: boolean;
    inviting: boolean;
    watching: boolean;
    rejoinPending: boolean;
    rejoinApproved: boolean;
    rejoinRejected: boolean;
    ended: boolean;
  };
};

export function useSpectatorSession(options: UseSpectatorSessionOptions): UseSpectatorSessionResult {
  const services = useMemo(() => {
    if (!options?.services) {
      return spectatorV2Service;
    }
    return {
      ...spectatorV2Service,
      ...options.services,
    };
  }, [options?.services]);

  const manualInviteResolution = options?.manualInviteResolution ?? false;
  const manualRejoinObservation = options?.manualRejoinObservation ?? false;

  const machine = useMemo(
    () =>
      createSpectatorSessionMachine({
        services,
        manualInviteResolution,
        manualRejoinObservation,
      }),
    [services, manualInviteResolution, manualRejoinObservation]
  );

  const [state, send] = useMachine(machine);
  const optionsRoomId = options?.roomId ?? null;
  const activeRoomId = state.context.roomId ?? optionsRoomId;

  // セッション初期化
  useEffect(() => {
    if (!options?.roomId) {
      send({ type: "RESET" });
      return;
    }
    if (state.context.roomId !== options.roomId || state.value === "idle") {
      send({
        type: "SESSION_INIT",
        roomId: options.roomId,
        viewerUid: options.viewerUid ?? null,
      });
    }
  }, [options?.roomId, options?.viewerUid, send, state.context.roomId, state.value]);

  const actions = useMemo(
    () => ({
      consumeInvite: (inviteId: string) => {
        if (!inviteId) return;
        send({ type: "INVITE_CONSUME", inviteId });
      },
      requestRejoin: (source: SpectatorRejoinSource) => {
        send({ type: "REQUEST_REJOIN", source });
      },
      reset: () => {
        send({ type: "RESET" });
      },
      approveRejoin: async (sessionId: string) => {
        if (!sessionId) return;
        const roomId = activeRoomId;
        if (!roomId) {
          throw new Error("room-not-initialized");
        }
        await services.approveRejoin({ sessionId, roomId });
      },
      rejectRejoin: async (sessionId: string, reason?: string | null) => {
        if (!sessionId) return;
        const roomId = activeRoomId;
        if (!roomId) {
          throw new Error("room-not-initialized");
        }
        await services.rejectRejoin({ sessionId, roomId, reason });
      },
    }),
    [send, services, activeRoomId]
  );

  const context = state.context;
  const status = context.status;

  const is = {
    idle: state.matches("idle"),
    ready: state.matches("ready"),
    inviting: state.matches("inviting"),
    watching: state.matches("watching"),
    rejoinPending: state.matches("rejoinPending"),
    rejoinApproved: state.matches("rejoinApproved"),
    rejoinRejected: state.matches("rejoinRejected"),
    ended: state.matches("ended"),
  };

  return {
    state,
    context,
    status,
    sessionId: context.sessionId,
    inviteId: context.inviteId,
    mode: context.mode,
    error: context.error,
    rejoinSnapshot: context.rejoinSnapshot,
    actions,
    is,
  };
}
