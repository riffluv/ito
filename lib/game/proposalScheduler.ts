import { recordMetricDistribution } from "@/lib/perf/metricsClient";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction } from "@/lib/utils/trace";
import {
  addCardToProposalAtPosition,
  moveCardInProposalToPosition,
  type ProposalWriteResult,
} from "./room";

type MutationKind = "add" | "move";

interface PendingMutation {
  roomId: string;
  playerId: string;
  kind: MutationKind;
  targetIndex: number;
  resolvers: Array<(value: unknown) => void>;
  rejecters: Array<(reason: unknown) => void>;
  timer: ReturnType<typeof setTimeout> | null;
  enqueuedAt: number;
}

const FLUSH_DELAY_MS = 12;
const pending = new Map<string, PendingMutation>();
const getNow =
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? () => performance.now()
    : () => Date.now();

const mutationKey = (roomId: string, playerId: string) => `${roomId}:${playerId}`;

const flushMutation = async (key: string) => {
  const queued = pending.get(key);
  if (!queued) return;
  pending.delete(key);

  if (queued.timer) {
    clearTimeout(queued.timer);
    queued.timer = null;
  }

  const queueWaitMs = Math.max(0, Math.round(getNow() - queued.enqueuedAt));
  recordMetricDistribution("client.drop.queueWaitMs", queueWaitMs, {
    kind: queued.kind,
  });
  setMetric(
    "client.drop",
    `${queued.kind}.queueWaitMs`,
    Number(queueWaitMs.toFixed(2))
  );
  traceAction("interaction.drop.queueWait", {
    roomId: queued.roomId,
    playerId: queued.playerId,
    kind: queued.kind,
    queueWaitMs,
  });

  try {
    let result: unknown;
    if (queued.kind === "move") {
      await moveCardInProposalToPosition(
        queued.roomId,
        queued.playerId,
        queued.targetIndex
      );
      result = undefined;
    } else {
      result = await addCardToProposalAtPosition(
        queued.roomId,
        queued.playerId,
        queued.targetIndex
      );
    }
    queued.resolvers.forEach((resolve) => resolve(result));
  } catch (error) {
    queued.rejecters.forEach((reject) => reject(error));
  }
};

const queueMutation = <T>(
  roomId: string,
  playerId: string,
  kind: MutationKind,
  targetIndex: number
): Promise<T> => {
  const key = mutationKey(roomId, playerId);
  const existing = pending.get(key);

  return new Promise<T>((resolve, reject) => {
    if (existing) {
      if (existing.timer) {
        clearTimeout(existing.timer);
      }
      existing.kind = kind;
      existing.targetIndex = targetIndex;
      existing.resolvers.push(resolve as (value: unknown) => void);
      existing.rejecters.push(reject);
      existing.enqueuedAt = getNow();
      existing.timer = setTimeout(() => {
        void flushMutation(key);
      }, FLUSH_DELAY_MS);
      return;
    }

    const entry: PendingMutation = {
      roomId,
      playerId,
      kind,
      targetIndex,
      resolvers: [resolve as (value: unknown) => void],
      rejecters: [reject],
      enqueuedAt: getNow(),
      timer: setTimeout(() => {
        void flushMutation(key);
      }, FLUSH_DELAY_MS),
    };
    pending.set(key, entry);
  });
};

export const scheduleAddCardToProposalAtPosition = (
  roomId: string,
  playerId: string,
  targetIndex: number
) => {
  return queueMutation<ProposalWriteResult>(roomId, playerId, "add", targetIndex);
};

export const scheduleMoveCardInProposalToPosition = (
  roomId: string,
  playerId: string,
  targetIndex: number
) => {
  return queueMutation<void>(roomId, playerId, "move", targetIndex);
};
