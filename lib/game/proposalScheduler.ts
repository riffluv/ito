import { recordMetricDistribution } from "@/lib/perf/metricsClient";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction } from "@/lib/utils/trace";
import {
  addCardToProposalAtPosition,
  moveCardInProposalToPosition,
  type ProposalWriteResult,
} from "./room";

type MutationKind = "add" | "move";

interface PendingJob {
  kind: MutationKind;
  targetIndex: number;
  resolvers: Array<(value: unknown) => void>;
  rejecters: Array<(reason: unknown) => void>;
  enqueuedAt: number;
}

interface PendingQueue {
  roomId: string;
  playerId: string;
  jobs: PendingJob[];
  timer: ReturnType<typeof setTimeout> | null;
  running: boolean;
}

const FLUSH_DELAY_MS = 12;
const pending = new Map<string, PendingQueue>();
const getNow =
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? () => performance.now()
    : () => Date.now();

const mutationKey = (roomId: string, playerId: string) => `${roomId}:${playerId}`;

const scheduleFlush = (key: string, state: PendingQueue, delay = FLUSH_DELAY_MS) => {
  if (state.running) return;
  if (state.timer) {
    clearTimeout(state.timer);
  }
  state.timer = setTimeout(() => {
    state.timer = null;
    void flushMutation(key);
  }, Math.max(0, delay));
};

const flushMutation = async (key: string) => {
  const queue = pending.get(key);
  if (!queue) return;
  if (queue.running) return;
  if (queue.timer) {
    clearTimeout(queue.timer);
    queue.timer = null;
  }
  queue.running = true;

  while (queue.jobs.length > 0) {
    const job = queue.jobs.shift();
    if (!job) break;
    const queueWaitMs = Math.max(0, Math.round(getNow() - job.enqueuedAt));
    recordMetricDistribution("client.drop.queueWaitMs", queueWaitMs, {
      kind: job.kind,
    });
    setMetric(
      "client.drop",
      `${job.kind}.queueWaitMs`,
      Number(queueWaitMs.toFixed(2))
    );
    traceAction("interaction.drop.queueWait", {
      roomId: queue.roomId,
      playerId: queue.playerId,
      kind: job.kind,
      queueWaitMs,
    });

    try {
      let result: unknown;
      if (job.kind === "move") {
        await moveCardInProposalToPosition(queue.roomId, queue.playerId, job.targetIndex);
        result = undefined;
      } else {
        result = await addCardToProposalAtPosition(queue.roomId, queue.playerId, job.targetIndex);
      }
      job.resolvers.forEach((resolve) => resolve(result));
    } catch (error) {
      job.rejecters.forEach((reject) => reject(error));
    }
  }

  queue.running = false;

  if (queue.jobs.length === 0) {
    pending.delete(key);
  } else {
    scheduleFlush(key, queue, 0);
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
    const job: PendingJob = {
      kind,
      targetIndex,
      resolvers: [resolve as (value: unknown) => void],
      rejecters: [reject],
      enqueuedAt: getNow(),
    };

    if (existing) {
      existing.jobs.push(job);
      scheduleFlush(key, existing);
      return;
    }

    const entry: PendingQueue = {
      roomId,
      playerId,
      jobs: [job],
      timer: null,
      running: false,
    };
    pending.set(key, entry);
    scheduleFlush(key, entry);
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
