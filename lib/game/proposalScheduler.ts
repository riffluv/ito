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
}

const FLUSH_DELAY_MS = 48;
const pending = new Map<string, PendingMutation>();

const mutationKey = (roomId: string, playerId: string) => `${roomId}:${playerId}`;

const flushMutation = async (key: string) => {
  const queued = pending.get(key);
  if (!queued) return;
  pending.delete(key);

  if (queued.timer) {
    clearTimeout(queued.timer);
    queued.timer = null;
  }

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
