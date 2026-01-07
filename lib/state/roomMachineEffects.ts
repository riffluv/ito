import type { DealNumbersOptions } from "@/lib/game/room";
import type {
  ResetRoomKeepIds,
  ResetRoomOptions,
  StartGameOptions,
} from "@/lib/game/service";

import { sanitizeOrderList } from "./roomMachineUtils";

type RoomMachineDepsLike = {
  startGame: (
    roomId: string,
    requestId: string,
    sessionIdOrOpts?: string | null | StartGameOptions
  ) => Promise<unknown>;
  dealNumbers: (roomId: string, options?: DealNumbersOptions) => Promise<unknown>;
  submitSortedOrder: (roomId: string, list: string[]) => Promise<unknown>;
  finalizeReveal: (roomId: string) => Promise<unknown>;
  resetRoomWithPrune: (
    roomId: string,
    keepIds: ResetRoomKeepIds,
    opts: ResetRoomOptions & { requestId: string; sessionId?: string | null }
  ) => Promise<unknown>;
};

const createRequestId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const isSubmitOrderEvent = (
  value: unknown
): value is { type: "SUBMIT_ORDER"; list: string[] } => {
  if (!isRecord(value)) return false;
  return value.type === "SUBMIT_ORDER" && isStringArray(value.list);
};

const isResetEvent = (
  value: unknown
): value is { type: "RESET"; keepIds?: ResetRoomKeepIds; options?: ResetRoomOptions } => {
  if (!isRecord(value)) return false;
  if (value.type !== "RESET") return false;
  // keepIds は型が複雑なのでここでは存在チェックのみ（後段でそのまま渡す）
  if ("options" in value && value.options !== undefined && !isRecord(value.options)) {
    return false;
  }
  return true;
};

export function createRoomMachineEffects(params: {
  deps: RoomMachineDepsLike;
  reportActionError: (action: string, error: unknown) => void;
}) {
  const { deps, reportActionError } = params;

  return {
    callStartGame: ({ context }: { context: { roomId: string } }) => {
      const requestId = createRequestId();
      void deps.startGame(context.roomId, requestId).catch((error) => {
        reportActionError("startGame", error);
      });
    },
    callDealNumbers: ({ context }: { context: { roomId: string } }) => {
      const requestId = createRequestId();
      void deps.dealNumbers(context.roomId, { requestId }).catch((error) => {
        reportActionError("dealNumbers", error);
      });
    },
    callSubmitOrder: ({
      context,
      event,
    }: {
      context: { roomId: string };
      event: unknown;
    }) => {
      if (!isSubmitOrderEvent(event)) return;
      const list = sanitizeOrderList(event.list);
      void deps.submitSortedOrder(context.roomId, list).catch((error) => {
        reportActionError("submitSortedOrder", error);
      });
    },
    callFinalizeReveal: ({ context }: { context: { roomId: string } }) => {
      void deps.finalizeReveal(context.roomId).catch((error) => {
        reportActionError("finalizeReveal", error);
      });
    },
    callReset: ({
      context,
      event,
    }: {
      context: { roomId: string };
      event: unknown;
    }) => {
      if (!isResetEvent(event)) return;
      const requestId = createRequestId();
      const optionsWithId = {
        ...(event.options ?? {}),
        requestId,
      } as ResetRoomOptions & { requestId: string };
      void deps
        .resetRoomWithPrune(context.roomId, event.keepIds as ResetRoomKeepIds, optionsWithId)
        .catch((error) => {
          reportActionError("resetRoomWithPrune", error);
        });
    },
  } as const;
}
