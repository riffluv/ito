import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createActor } from "xstate";
import {
  createRoomMachine,
  type RoomMachineActorRef,
  type RoomMachineClientEvent,
  type RoomMachineSnapshot,
  type SpectatorReason,
  type SpectatorRequestSource,
  type SpectatorStatus,
  type SpectatorRejoinSnapshot,
} from "@/lib/state/roomMachine";
import type { PlayerDoc, RoomDoc } from "@/lib/types";

export type SpectatorState = {
  spectatorStatus: SpectatorStatus;
  spectatorReason: SpectatorReason;
  spectatorRequestSource: SpectatorRequestSource;
  spectatorError: string | null;
  spectatorRequestStatus: "idle" | "pending" | "accepted" | "rejected";
  spectatorRequestCreatedAt: number | null;
  spectatorRequestFailure: string | null;
  spectatorNode: SpectatorStatus;
};

export type SubscribeSpectatorRejoin = (params: {
  roomId: string;
  uid: string;
  onSnapshot: (snapshot: SpectatorRejoinSnapshot) => void;
  onError?: (error: unknown) => void;
}) => void | (() => void);

type UseRoomMachineControllerOptions = {
  roomId: string;
  uid: string | null;
  room: (RoomDoc & { id: string }) | null;
  players: (PlayerDoc & { id: string })[];
  onlineUids?: string[] | null;
  presenceReady: boolean;
  presenceDegraded?: boolean;
  subscribeSpectatorRejoin?: SubscribeSpectatorRejoin;
};

const extractPhaseFromSnapshot = (
  snapshot: RoomMachineSnapshot | null
): RoomDoc["status"] | null => {
  if (!snapshot) return null;
  const value = snapshot.value;
  if (typeof value === "string") return value as RoomDoc["status"];
  if (value && typeof value === "object") {
    const phase = (value as { phase?: unknown }).phase;
    if (typeof phase === "string") {
      return phase as RoomDoc["status"];
    }
  }
  return null;
};

const extractSpectatorNode = (
  snapshot: RoomMachineSnapshot | null
): SpectatorStatus => {
  if (!snapshot) return "idle";
  const value = snapshot.value;
  if (value && typeof value === "object" && value !== null) {
    const node = (value as { spectator?: unknown }).spectator;
    if (typeof node === "string") {
      return node as SpectatorStatus;
    }
  }
  if (typeof value === "string") {
    return value as SpectatorStatus;
  }
  return snapshot.context.spectatorStatus;
};

export function useRoomMachineController({
  roomId,
  uid,
  room,
  players,
  onlineUids,
  presenceReady,
  presenceDegraded = false,
  subscribeSpectatorRejoin,
}: UseRoomMachineControllerOptions) {
  const machineRef = useRef<RoomMachineActorRef | null>(null);
  const pendingMachineEventsRef = useRef<RoomMachineClientEvent[]>([]);
  const [machineSnapshot, setMachineSnapshot] = useState<RoomMachineSnapshot | null>(
    null
  );

  useEffect(() => {
    const actor = createActor(
      createRoomMachine({
        roomId,
        room,
        players,
        onlineUids: onlineUids ?? undefined,
        presenceReady,
        viewerUid: uid ?? null,
        deps: {
          subscribeSpectatorRejoin,
        },
      })
    );
    actor.start();
    setMachineSnapshot(actor.getSnapshot());
    const subscription = actor.subscribe((snapshot) => {
      setMachineSnapshot(snapshot);
    });
    if (machineRef.current) {
      machineRef.current.stop();
    }
    machineRef.current = actor;
    if (pendingMachineEventsRef.current.length > 0) {
      const pendingEvents = pendingMachineEventsRef.current.slice();
      pendingMachineEventsRef.current = [];
      for (const pendingEvent of pendingEvents) {
        actor.send(pendingEvent);
      }
    }

    return () => {
      subscription.unsubscribe();
      actor.stop();
      if (machineRef.current === actor) {
        machineRef.current = null;
      }
    };
  }, [roomId, uid, room, players, onlineUids, presenceReady, subscribeSpectatorRejoin]);

  // keep machine context in sync
  useEffect(() => {
    const actor = machineRef.current;
    if (!actor) return;
    actor.send({
      type: "SYNC",
      room,
      players,
      onlineUids: onlineUids ?? undefined,
      presenceReady: presenceReady || presenceDegraded,
    });
  }, [room, players, onlineUids, presenceReady, presenceDegraded]);

  const effectivePhase = useMemo<RoomDoc["status"]>(() => {
    const phaseState = extractPhaseFromSnapshot(machineSnapshot);
    if (phaseState) return phaseState;
    if (room?.status) return room.status;
    return "waiting";
  }, [machineSnapshot, room?.status]);

  const spectatorState = useMemo<SpectatorState>(() => {
    const snapshot = machineSnapshot;
    if (!snapshot) {
      return {
        spectatorStatus: "idle",
        spectatorReason: null,
        spectatorRequestSource: null,
        spectatorError: null,
        spectatorRequestStatus: "idle",
        spectatorRequestCreatedAt: null,
        spectatorRequestFailure: null,
        spectatorNode: "idle",
      };
    }
    const spectatorNode = extractSpectatorNode(snapshot);
    return {
      spectatorStatus: snapshot.context.spectatorStatus,
      spectatorReason: snapshot.context.spectatorReason,
      spectatorRequestSource: snapshot.context.spectatorRequestSource,
      spectatorError: snapshot.context.spectatorError,
      spectatorRequestStatus: snapshot.context.spectatorRequestStatus,
      spectatorRequestCreatedAt: snapshot.context.spectatorRequestCreatedAt,
      spectatorRequestFailure: snapshot.context.spectatorRequestFailure,
      spectatorNode,
    };
  }, [machineSnapshot]);

  const sendRoomEvent = useCallback((event: RoomMachineClientEvent) => {
    const actor = machineRef.current;
    if (actor) {
      actor.send(event);
      return;
    }
    pendingMachineEventsRef.current.push(event);
  }, []);

  return {
    phase: effectivePhase,
    spectatorState,
    sendRoomEvent,
  } as const;
}
