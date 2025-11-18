import { db } from "@/lib/firebase/client";
import { fetchPresenceUids, presenceSupported } from "@/lib/firebase/presence";
import { sendNotifyEvent } from "@/lib/firebase/events";
import { enqueueFirestoreWrite } from "@/lib/firebase/writeQueue";
import { recordProposalWriteMetrics } from "@/lib/metrics/proposalMetrics";
import { requireDb } from "@/lib/firebase/require";
import { normalizeResolveMode } from "@/lib/game/resolveMode";
import {
  applyPlay,
  evaluateSorted,
  shouldFinishAfterPlay,
  type OrderState,
} from "@/lib/game/rules";
import { applyOutcomeToRoomStats } from "@/lib/game/roomStats";
import { generateDeterministicNumbers } from "@/lib/game/random";
import { nextStatusForEvent } from "@/lib/state/guards";
import { ACTIVE_WINDOW_MS, isActive, toMillis } from "@/lib/time";
import {
  normalizeProposal,
  selectDealTargetPlayers,
  deriveSeatHistory,
  buildDealPayload,
  diffProposal,
} from "@/lib/game/domain";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type FieldValue,
  type FirestoreError,
  type Timestamp,
} from "firebase/firestore";
import type { PlayerDoc, RoomDoc } from "@/lib/types";

// 乱数はクライアントで自分の番号計算に使用

// 通知ブロードキャスト関数
async function broadcastNotify(
  roomId: string,
  type: "info" | "warning" | "success" | "error",
  title: string,
  description?: string,
  contextKey?: string
) {
  try {
    await sendNotifyEvent(roomId, {
      type,
      title,
      description,
      dedupeKey: contextKey,
    });
  } catch {
    // ignore broadcast failure
  }
}

type DealCandidate = {
  id: string;
  uid?: string;
  lastSeen?: Timestamp | Date | number | FieldValue | null;
};

type RoomProposalDoc = {
  proposal?: (string | null | undefined)[];
  seed?: string | null;
  updatedAt?: Timestamp | FieldValue | null;
};

type RoomOrderState = NonNullable<RoomDoc["order"]>;

const PROPOSAL_QUEUE_MIN_INTERVAL_MS = 0;
const RETRYABLE_TRANSACTION_ERROR_CODES = new Set([
  "aborted",
  "failed-precondition",
  "deadline-exceeded",
  "unavailable",
]);

export type DealNumbersOptions = {
  skipPresence?: boolean;
};

function proposalQueueKey(roomId: string, playerId: string) {
  // Firestore の roomProposals コレクションはルーム単位で共有されるが、
  // 体感を優先してプレイヤーごとのキューへ分割し並列性を高める。
  // playerId は scope 名に含め、メトリクス／トレースからも識別できるようにする。
  return `proposal:${roomId}:player:${playerId}`;
}

function isRetryableTransactionError(error: unknown): boolean {
  const code = (error as FirestoreError | undefined)?.code;
  if (!code) return false;
  return RETRYABLE_TRANSACTION_ERROR_CODES.has(code);
}

function wait(delayMs: number) {
  if (delayMs <= 0) return Promise.resolve();
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

const ROOM_PROPOSAL_COLLECTION = "roomProposals";

function proposalRef(roomId: string) {
  return doc(db!, ROOM_PROPOSAL_COLLECTION, roomId);
}

function readProposal(source: unknown): (string | null)[] {
  if (!Array.isArray(source)) return [];
  return (source as (string | null | undefined)[]).map((value) =>
    typeof value === "string" && value.length > 0 ? value : null
  );
}

export async function startGame(roomId: string) {
  const ref = doc(db!, "rooms", roomId);
  const snap = await getDoc(ref);
  const curr = snap.data() as RoomDoc | undefined;
  const currentStatus = curr?.status || "waiting";
  // 進行中や終了直後からの誤開始を防止（必ずwaitingからのみ開始）
  if (currentStatus !== "waiting") {
    throw new Error("開始できるのは待機中のみです");
  }
  // 新ラウンド開始時は前ラウンドの order/result/deal をクリア
  // Spectator V3: ゲーム開始時は観戦者の入席を拒否
  traceAction("ui.recallOpen.set", {
    roomId,
    value: "0",
    reason: "startGame",
  });
  await updateDoc(ref, {
    status: "clue",
    result: null,
    deal: null,
    order: null,
    mvpVotes: {},
    lastActiveAt: serverTimestamp(),
    "ui.recallOpen": false,
  });
  // プレイヤーの一時状態も同時に初期化（古い連想が残るのを防止）
  try {
    const { collection, getDocs, writeBatch } = await import("firebase/firestore");
    const playersRef = collection(db!, "rooms", roomId, "players");
    const ps = await getDocs(playersRef);
    const batch = writeBatch(db!);
    ps.forEach((d) => {
      batch.update(d.ref, { number: null, clue1: "", ready: false, orderIndex: 0 });
    });
    await batch.commit();
  } catch {}

  // ゲーム開始通知をブロードキャスト
  try {
    await broadcastNotify(
      roomId,
      "success",
      "ゲームを開始しました",
      "連想ワードを入力してください",
      "room:start"
    );
  } catch {
    // 通知失敗は無視
  }
}

// ホストがトピック選択後に配札（重複なし）
export async function dealNumbers(
  roomId: string,
  attempt = 0,
  options?: DealNumbersOptions
): Promise<number> {
  const startedAt = Date.now();
  const skipPresence = options?.skipPresence === true;
  traceAction("deal.start", {
    roomId,
    attempt: String(attempt),
    skipPresence: skipPresence ? "1" : "0",
  });
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const min = 1;
  const max = 100;

  const presenceSupportedNow = !skipPresence && presenceSupported();
  const presencePromise: Promise<string[] | null> = presenceSupportedNow
    ? fetchPresenceUids(roomId)
        .then((fetched) =>
          Array.isArray(fetched) && fetched.length > 0 ? fetched : null
        )
        .catch(() => null)
    : Promise.resolve(null);

  const snap = await getDocs(collection(db!, "rooms", roomId, "players"));
  const all: DealCandidate[] = [];
  snap.forEach((d) => {
    const data = d.data() as PlayerDoc | undefined;
    all.push({
      id: d.id,
      uid: typeof data?.uid === "string" ? data.uid : undefined,
      lastSeen: data?.lastSeen ?? null,
    });
  });
  const now = Date.now();

  const presenceUids = await presencePromise;

  const target = selectDealTargetPlayers(all, presenceUids, now);

  let ordered = [...target].sort((a, b) =>
    String(a.uid || a.id).localeCompare(String(b.uid || b.id))
  );

  const eligibleCount = all.filter(
    (candidate) => typeof candidate.uid === "string" && candidate.uid.trim().length > 0
  ).length;
  const suspectedMismatch = eligibleCount > 1 && ordered.length <= 1;

  if (suspectedMismatch) {
    traceError(
      "deal.mismatch",
      new Error("dealPlayersMismatch"),
      {
        roomId,
        eligibleCount,
        assignedCount: ordered.length,
        attempt: String(attempt),
      }
    );
    const fallbackOrdered = [...all].sort((a, b) =>
      String(a.uid || a.id).localeCompare(String(b.uid || b.id))
    );
    if (fallbackOrdered.length > ordered.length) {
      ordered = fallbackOrdered;
    }
  }

  const playerIds = ordered.map((p) => p.id);
  const generatedNumbers = generateDeterministicNumbers(
    playerIds.length,
    min,
    max,
    seed
  );
  const dealPayload = buildDealPayload(playerIds, seed, min, max, generatedNumbers);

  await updateDoc(doc(db!, "rooms", roomId), {
    deal: dealPayload,
    "order.total": ordered.length,
    "order.numbers": dealPayload.numbers,
    lastActiveAt: serverTimestamp(),
  });
  try {
    await setDoc(
      proposalRef(roomId),
      {
        proposal: [],
        seed,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    traceError("proposal.reset", error, { roomId });
  }
  traceAction("deal.end", {
    roomId,
    count: ordered.length,
    eligibleCount,
    attempt: String(attempt),
    elapsedMs: Math.max(0, Date.now() - startedAt),
  });
  return ordered.length;
}

// finalizeOrder（公開順演出）は現行フローでは未使用

export async function finishRoom(roomId: string, success: boolean) {
  const ref = doc(db!, "rooms", roomId);
  const snap = await getDoc(ref);
  const curr = snap.data() as RoomDoc | undefined;
  const next = nextStatusForEvent(curr?.status || "waiting", {
    type: "FINISH",
  });
  if (!next) throw new Error("invalid transition: FINISH");
  const stats = applyOutcomeToRoomStats(
    curr?.stats,
    success ? "success" : "failure"
  );
  await updateDoc(ref, {
    status: next,
    result: { success, revealedAt: serverTimestamp() },
    stats,
  });
}

export async function continueAfterFail(roomId: string) {
  // 次ラウンドへ進む前に waiting に戻す（お題/配札はホストの開始操作で行う）
  const ref = doc(db!, "rooms", roomId);
  const snap = await getDoc(ref);
  const curr = snap.data() as RoomDoc | undefined;
  // 誤操作防止: reveal/finished 以外では実行不可
  if (curr?.status !== "reveal" && curr?.status !== "finished") {
    throw new Error("進行中は継続できません");
  }
  await updateDoc(ref, {
    status: "waiting",
    result: null,
    order: null,
    deal: null,
    mvpVotes: {},
    lastActiveAt: serverTimestamp(),
  });
  // waiting に戻るタイミングでプレイヤーの連想/readyも即時クリア
  try {
    const { collection, getDocs, writeBatch } = await import("firebase/firestore");
    const playersRef = collection(db!, "rooms", roomId, "players");
    const ps = await getDocs(playersRef);
    const batch = writeBatch(db!);
    ps.forEach((d) => {
      batch.update(d.ref, { clue1: "", ready: false, number: null, orderIndex: 0 });
    });
    await batch.commit();
  } catch (e) {
    console.error("❌ continueAfterFail: プレイヤー状態クリア失敗", e);
  }
}

export async function resetRoom(roomId: string) {
  const ref = doc(db!, "rooms", roomId);
  const snap = await getDoc(ref);
  const curr = snap.data() as RoomDoc | undefined;
  const next = nextStatusForEvent(curr?.status || "waiting", { type: "RESET" });
  if (!next) throw new Error("invalid transition: RESET");
  await updateDoc(ref, { status: next, result: null, deal: null, order: null, mvpVotes: {}, lastActiveAt: serverTimestamp() });
  try {
    const { collection, getDocs, writeBatch } = await import("firebase/firestore");
    const playersRef = collection(db!, "rooms", roomId, "players");
    const ps = await getDocs(playersRef);
    const batch = writeBatch(db!);
    ps.forEach((d) => {
      batch.update(d.ref, { number: null, clue1: "", ready: false, orderIndex: 0 });
    });
    await batch.commit();
  } catch {}
}

// chooseAfterFail は不要（失敗後は自動継続または即終了）

// 並べ替え提案を保存（ルームの order.proposal に保存）
export async function setOrderProposal(roomId: string, proposal: string[]) {
  const _db = requireDb();
  const normalized = Array.isArray(proposal)
    ? proposal.map((value) =>
        typeof value === "string" && value.length > 0 ? value : null
      )
    : [];
  await Promise.all([
    updateDoc(doc(_db, "rooms", roomId), { "order.proposal": normalized }),
    setDoc(
      doc(_db, ROOM_PROPOSAL_COLLECTION, roomId),
      {
        proposal: normalized,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ),
  ]);
}

export type ProposalWriteResult = "ok" | "noop" | "missing-deal";

// sort-submit モード: プレイヤーが自分のカードを場(提案配列)に置く
// 既存の末尾追加機能（「出す」ボタン用）
export async function addCardToProposal(
  roomId: string,
  playerId: string
): Promise<ProposalWriteResult> {
  return addCardToProposalAtPosition(roomId, playerId, -1); // -1 = 末尾追加
}

// 新機能：位置指定でカード追加（WaitingCardドラッグ用）
export async function addCardToProposalAtPosition(
  roomId: string,
  playerId: string,
  targetIndex: number = -1
): Promise<ProposalWriteResult> {
  const roomRef = doc(db!, "rooms", roomId);
  const proposalDocRef = proposalRef(roomId);
  const queueScope = proposalQueueKey(roomId, playerId);

  const runOnce = async (attemptIndex: number): Promise<ProposalWriteResult> => {
    const readTimestamp =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? () => performance.now()
        : () => Date.now();
    const enqueuedAt = readTimestamp();

    const result = await enqueueFirestoreWrite<ProposalWriteResult>(
      queueScope,
      async () => {
        const dequeuedAt = readTimestamp();
        const queueWaitMs = Math.max(0, Math.round(dequeuedAt - enqueuedAt));
        const startedAt = dequeuedAt;
        const attemptContext = {
          roomId,
          playerId,
          attempt: String(attemptIndex),
          queueWaitMs,
          queueScope,
        };

        traceAction("lag.drop.tx.start", attemptContext);

        let txResult: ProposalWriteResult | "error" | null = null;
        let detailMetrics:
          | {
              roundPlayerCount: number;
              previousLength: number;
              normalizedLength: number;
              nullCount: number;
              changedSlots: number;
              finalIndex: number;
              targetIndex: number;
              roomGetMs: number;
              proposalGetMs: number;
              playerGetMs: number;
              prepareMs: number;
            }
          | null = null;

        try {
          const transactionResult = await runTransaction(db!, async (tx) => {
            const readStart = readTimestamp();
            const roomSnap = await tx.get(roomRef);
            const afterRoomGet = readTimestamp();
            if (!roomSnap.exists()) throw new Error("room not found");
            const room = roomSnap.data() as RoomDoc;
            if (room.status !== "clue") {
              return { status: "noop" as ProposalWriteResult };
            }
            if (room?.options?.resolveMode !== "sort-submit") {
              return { status: "noop" as ProposalWriteResult };
            }

            const roundPlayers: string[] | null = Array.isArray(room?.deal?.players)
              ? (room.deal.players as string[])
              : null;
            if (!roundPlayers || roundPlayers.length === 0) {
              traceAction("lag.drop.missingDeal", {
                roomId,
                playerId,
                attempt: String(attemptIndex),
                reason: "no-round-players",
              });
              return { status: "missing-deal" as ProposalWriteResult };
            }
            if (!roundPlayers.includes(playerId)) {
              traceAction("lag.drop.missingDeal", {
                roomId,
                playerId,
                attempt: String(attemptIndex),
                reason: "player-not-in-round",
              });
              return { status: "missing-deal" as ProposalWriteResult };
            }

            const maxCount = roundPlayers.length;
            if (maxCount <= 0) {
              traceAction("lag.drop.missingDeal", {
                roomId,
                playerId,
                attempt: String(attemptIndex),
                reason: "invalid-max-count",
              });
              return { status: "missing-deal" as ProposalWriteResult };
            }

            const proposalSnap = await tx.get(proposalDocRef);
            const afterProposalGet = readTimestamp();
            const proposalData = proposalSnap.exists()
              ? (proposalSnap.data() as RoomProposalDoc)
              : null;

            const roomSeed =
              typeof room?.deal?.seed === "string" ? room.deal.seed : null;
            const docSeed =
              typeof proposalData?.seed === "string" ? proposalData.seed : null;

            let current = readProposal(
              proposalData?.proposal ?? room?.order?.proposal
            );
            if (docSeed && roomSeed && docSeed !== roomSeed) {
              current = [];
            }

            if (current.includes(playerId)) {
              return { status: "noop" as ProposalWriteResult };
            }

            const next = [...current];

            if (targetIndex === -1) {
              let placed = false;
              const limit = Math.max(next.length, maxCount);
              for (let i = 0; i < limit; i += 1) {
                if (i >= next.length) next.length = i + 1;
                if (next[i] === null || next[i] === undefined) {
                  next[i] = playerId;
                  placed = true;
                  break;
                }
              }
              if (!placed) next.push(playerId);
            } else {
              const clamped = Math.max(0, Math.min(targetIndex, Math.max(0, maxCount - 1)));
              if (clamped < next.length) {
                if (typeof next[clamped] === "string" && next[clamped]) {
                  return { status: "noop" as ProposalWriteResult };
                }
              } else {
                next.length = clamped + 1;
              }
              next[clamped] = playerId;
            }

            if (maxCount > 0 && next.length > maxCount) {
              next.length = maxCount;
            }

            const normalized = normalizeProposal(next, maxCount);
            const afterPrepare = readTimestamp();
            const { changedSlots, nullCount } = diffProposal(current, normalized);

            detailMetrics = {
              roundPlayerCount: maxCount,
              previousLength: current.length,
              normalizedLength: normalized.length,
              nullCount,
              changedSlots,
              finalIndex: normalized.indexOf(playerId),
              targetIndex,
              roomGetMs: Math.max(0, Math.round(afterRoomGet - readStart)),
              proposalGetMs: Math.max(0, Math.round(afterProposalGet - afterRoomGet)),
              playerGetMs: 0,
              prepareMs: Math.max(0, Math.round(afterPrepare - afterProposalGet)),
            };

            tx.set(
              proposalDocRef,
              {
                proposal: normalized,
                seed: roomSeed ?? docSeed ?? null,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );

            // CRITICAL FIX: Update rooms.order.proposal atomically within transaction
            // This ensures UI sees the update immediately without relying on separate syncRoomProposal
            tx.update(roomRef, {
              "order.proposal": normalized,
              lastActiveAt: serverTimestamp(),
            });

            return {
              status: "ok" as ProposalWriteResult,
              proposal: normalized,
            };
          });

          txResult = transactionResult.status;
          if (detailMetrics) {
            const {
              roundPlayerCount,
              previousLength,
              normalizedLength,
              nullCount,
              changedSlots,
              finalIndex,
              targetIndex: detailTargetIndex,
              roomGetMs,
              proposalGetMs,
              playerGetMs,
              prepareMs,
            } = detailMetrics;
            traceAction("lag.drop.tx.detail", {
              ...attemptContext,
              roundPlayerCount,
              previousLength,
              normalizedLength,
              nullCount,
              changedSlots,
              finalIndex,
              targetIndex: detailTargetIndex,
              roomGetMs,
              proposalGetMs,
              playerGetMs,
              prepareMs,
            });
          }

          // No longer need to sync separately - rooms.order.proposal is updated atomically in transaction
          return transactionResult.status;
        } catch (error) {
          txResult = "error";
          throw error;
        } finally {
          const elapsedMs = Math.max(0, Math.round(readTimestamp() - startedAt));
          traceAction("lag.drop.tx.finish", {
            ...attemptContext,
            result: txResult ?? "unknown",
            elapsedMs,
          });
          recordProposalWriteMetrics({
            scope: queueScope,
            queueWaitMs,
            elapsedMs,
            result: txResult ?? "unknown",
          });
        }
      },
      { minIntervalMs: PROPOSAL_QUEUE_MIN_INTERVAL_MS }
    );

    // No longer need to sync separately - rooms.order.proposal is updated atomically in transaction
    return result;
  };

  const MAX_ATTEMPTS = 5;
  let missingDealRetries = 0;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let result: ProposalWriteResult;

    try {
      result = await runOnce(attempt);
    } catch (error) {
      if (isRetryableTransactionError(error) && attempt < MAX_ATTEMPTS - 1) {
        const backoffMs = Math.min(400 * (attempt + 1), 1600);
        traceAction("lag.drop.retry.txError", {
          roomId,
          playerId,
          attempt: String(attempt),
          backoffMs: String(backoffMs),
          code: (error as FirestoreError)?.code ?? "unknown",
        });
        await wait(backoffMs);
        continue;
      }
      throw error;
    }

    if (result === "ok" || result === "noop") {
      return result;
    }

    if (result === "missing-deal") {
      if (missingDealRetries === 0) {
        traceAction("lag.drop.dealNumbers.triggered", {
          roomId,
          playerId,
          attempt: String(attempt),
        });
        traceAction("lag.drop.missingDeal.retry.wait", {
          roomId,
          playerId,
          attempt: String(attempt),
          delayMs: "400",
        });
        await wait(400);
      } else if (missingDealRetries === 1) {
        traceAction("lag.drop.retry.wait", {
          roomId,
          playerId,
          attempt: String(attempt),
          delayMs: "800",
        });
        await wait(800);
      } else {
        traceAction("lag.drop.missingDeal.exhausted", {
          roomId,
          playerId,
        });
        throw new Error(
          "カードの提出準備が整っていません。通信状況をご確認のうえ、再接続またはホストに確認してください。"
        );
      }
      missingDealRetries += 1;
      continue;
    }
  }

  throw new Error("カードの提出に失敗しました");
}

// 既にproposalに含まれるカードを、空きスロットに移動（重複防止）。


// proposal からカードを取り除き、待機エリアへ戻す
export async function removeCardFromProposal(roomId: string, playerId: string) {
  const roomRef = doc(db!, "rooms", roomId);
  const proposalDocRef = proposalRef(roomId);
  const queueScope = proposalQueueKey(roomId, playerId);
  const readTimestamp =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? () => performance.now()
      : () => Date.now();
  const enqueuedAt = readTimestamp();
  await enqueueFirestoreWrite(
    queueScope,
    async () => {
      const dequeuedAt = readTimestamp();
      const queueWaitMs = Math.max(0, Math.round(dequeuedAt - enqueuedAt));
      const startedAt = dequeuedAt;
      let txResult: ProposalWriteResult | "noop" | "error" | null = null;
      const MAX_ATTEMPTS = 5;
      try {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
          try {
            await runTransaction(db!, async (tx) => {
              const roomSnap = await tx.get(roomRef);
              if (!roomSnap.exists()) throw new Error("room not found");
              const room = roomSnap.data() as RoomDoc;
              if (room.status !== "clue") {
                txResult = "noop";
                return;
              }
              if (room?.options?.resolveMode !== "sort-submit") {
                txResult = "noop";
                return;
              }
              const roundPlayers: string[] | null = Array.isArray(room?.deal?.players)
                ? (room.deal.players as string[])
                : null;
              if (!roundPlayers || roundPlayers.length === 0) {
                txResult = "noop";
                return;
              }
              if (!roundPlayers.includes(playerId)) {
                txResult = "noop";
                return;
              }
              const maxCount: number = roundPlayers.length;
              if (maxCount <= 0) {
                txResult = "noop";
                return;
              }
              const proposalSnap = await tx.get(proposalDocRef);
              const proposalData = proposalSnap.exists()
                ? (proposalSnap.data() as RoomProposalDoc)
                : null;
              const roomSeed =
                typeof room?.deal?.seed === "string" ? room.deal.seed : null;
              const docSeed =
                typeof proposalData?.seed === "string" ? proposalData.seed : null;
              let current = readProposal(
                proposalData?.proposal ?? room?.order?.proposal
              );
              if (docSeed && roomSeed && docSeed !== roomSeed) {
                current = [];
              }
              const targetIndex = current.findIndex((v) => v === playerId);
              if (targetIndex < 0) {
                txResult = "noop";
                return;
              }
              current[targetIndex] = null;
              const normalized = normalizeProposal(current, maxCount);
              tx.set(
                proposalDocRef,
                {
                  proposal: normalized,
                  seed: roomSeed ?? docSeed ?? null,
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );

              // CRITICAL FIX: Update rooms.order.proposal atomically within transaction
              tx.update(roomRef, {
                "order.proposal": normalized,
                lastActiveAt: serverTimestamp(),
              });

              txResult = "ok";
            });
            return;
          } catch (error) {
            if (isRetryableTransactionError(error) && attempt < MAX_ATTEMPTS - 1) {
              const backoffMs = Math.min(400 * (attempt + 1), 1600);
              traceAction("lag.drop.retry.txError", {
                roomId,
                playerId,
                attempt: String(attempt),
                backoffMs: String(backoffMs),
                scope: "remove",
                code: (error as FirestoreError | undefined)?.code ?? "unknown",
              });
              await wait(backoffMs);
              continue;
            }
            txResult = "error";
            throw error;
          }
        }
      } finally {
        const elapsedMs = Math.max(0, Math.round(readTimestamp() - startedAt));
        recordProposalWriteMetrics({
          scope: queueScope,
          queueWaitMs,
          elapsedMs,
          result: txResult ?? "unknown",
        });
      }
    },
    { minIntervalMs: PROPOSAL_QUEUE_MIN_INTERVAL_MS }
  );
  // No longer need to sync separately - rooms.order.proposal is updated atomically in transaction
}
export async function moveCardInProposalToPosition(
  roomId: string,
  playerId: string,
  targetIndex: number
) {
  const roomRef = doc(db!, "rooms", roomId);
  const proposalDocRef = proposalRef(roomId);
  const queueScope = proposalQueueKey(roomId, playerId);
  const readTimestamp =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? () => performance.now()
      : () => Date.now();
  const enqueuedAt = readTimestamp();
  await enqueueFirestoreWrite(
    queueScope,
    async () => {
      const dequeuedAt = readTimestamp();
      const queueWaitMs = Math.max(0, Math.round(dequeuedAt - enqueuedAt));
      const startedAt = dequeuedAt;
      let txResult: ProposalWriteResult | "noop" | "error" | null = null;
      const MAX_ATTEMPTS = 5;
      try {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
          try {
            await runTransaction(db!, async (tx) => {
              const roomSnap = await tx.get(roomRef);
              if (!roomSnap.exists()) throw new Error("room not found");
              const room = roomSnap.data() as RoomDoc;
              if (room.status !== "clue") {
                txResult = "noop";
                return;
              }
              if (room?.options?.resolveMode !== "sort-submit") {
                txResult = "noop";
                return;
              }
              const roundPlayers: string[] | null = Array.isArray(room?.deal?.players)
                ? (room.deal.players as string[])
                : null;
              if (!roundPlayers || roundPlayers.length === 0) {
                txResult = "noop";
                return;
              }
              if (!roundPlayers.includes(playerId)) {
                txResult = "noop";
                return;
              }
              const maxCount: number = roundPlayers.length;
              if (maxCount <= 0) {
                txResult = "noop";
                return;
              }
              const proposalSnap = await tx.get(proposalDocRef);
              const proposalData = proposalSnap.exists()
                ? (proposalSnap.data() as RoomProposalDoc)
                : null;
              const roomSeed =
                typeof room?.deal?.seed === "string" ? room.deal.seed : null;
              const docSeed =
                typeof proposalData?.seed === "string" ? proposalData.seed : null;
              let current = readProposal(
                proposalData?.proposal ?? room?.order?.proposal
              );
              if (docSeed && roomSeed && docSeed !== roomSeed) {
                current = [];
              }
              const fromIdx = current.findIndex((v) => v === playerId);
              if (fromIdx < 0) {
                txResult = "noop";
                return;
              }
              const clamped = Math.max(
                0,
                Math.min(targetIndex, Math.max(0, maxCount - 1))
              );
              const targetValue = current[clamped];
              if (typeof targetValue === "string" && targetValue !== playerId) {
                current[clamped] = playerId;
                current[fromIdx] = targetValue;
              } else {
                current[fromIdx] = null;
                if (clamped >= current.length) current.length = clamped + 1;
                current[clamped] = playerId;
              }
              if (maxCount > 0 && current.length > maxCount) {
                current.length = maxCount;
              }
              const normalized = normalizeProposal(current, maxCount);
              tx.set(
                proposalDocRef,
                {
                  proposal: normalized,
                  seed: roomSeed ?? docSeed ?? null,
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );

              // CRITICAL FIX: Update rooms.order.proposal atomically within transaction
              tx.update(roomRef, {
                "order.proposal": normalized,
                lastActiveAt: serverTimestamp(),
              });

              txResult = "ok";
            });
            return;
          } catch (error) {
            if (isRetryableTransactionError(error) && attempt < MAX_ATTEMPTS - 1) {
              const backoffMs = Math.min(400 * (attempt + 1), 1600);
              traceAction("lag.drop.retry.txError", {
                roomId,
                playerId,
                attempt: String(attempt),
                backoffMs: String(backoffMs),
                scope: "move",
                code: (error as FirestoreError | undefined)?.code ?? "unknown",
              });
              await wait(backoffMs);
              continue;
            }
            txResult = "error";
            throw error;
          }
        }
      } finally {
        const elapsedMs = Math.max(0, Math.round(readTimestamp() - startedAt));
        recordProposalWriteMetrics({
          scope: queueScope,
          queueWaitMs,
          elapsedMs,
          result: txResult ?? "unknown",
        });
      }
    },
    { minIntervalMs: PROPOSAL_QUEUE_MIN_INTERVAL_MS }
  );
  // No longer need to sync separately - rooms.order.proposal is updated atomically in transaction
}

// ドロップ時にクライアントが即時にカードを場に出して判定する（clue フェーズ用）
export async function commitPlayFromClue(roomId: string, playerId: string) {
  const roomRef = doc(db!, "rooms", roomId);
  const meRef = doc(db!, "rooms", roomId, "players", playerId);

  await runTransaction(db!, async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) throw new Error("room not found");
    const room = roomSnap.data() as RoomDoc;
    // clue フェーズ（または legacy playing）でのみ即時判定を受け付ける
    if (room.status !== "clue") return;
    const allowContinue: boolean = !!room?.options?.allowContinueAfterFail;

    const meSnap = await tx.get(meRef);
    if (!meSnap.exists()) throw new Error("player not found");
    const me = meSnap.data() as PlayerDoc | undefined;
    const myNum: number | null =
      typeof me?.number === "number" ? me.number : null;
    if (typeof myNum !== "number") throw new Error("number not set");

    const roundPlayers: string[] | null = Array.isArray(room?.deal?.players)
      ? (room.deal.players as string[])
      : null;
    const roundTotal: number | null = roundPlayers ? roundPlayers.length : null;
    const decidedAtSource = room?.order?.decidedAt ?? null;
    const decidedAtMs = toMillis(decidedAtSource);
    const currentOrder: OrderState = {
      list: Array.isArray(room?.order?.list) ? [...room.order.list] : [],
      lastNumber:
        typeof room?.order?.lastNumber === "number"
          ? room.order.lastNumber
          : null,
      failed: !!room?.order?.failed,
      failedAt:
        typeof room?.order?.failedAt === "number"
          ? room.order.failedAt
          : null,
      decidedAt: decidedAtMs > 0 ? decidedAtMs : Date.now(),
      total:
        typeof roundTotal === "number"
          ? roundTotal
          : typeof room?.order?.total === "number"
          ? room.order.total
          : undefined,
    };

    if (currentOrder.list.includes(playerId)) return; // 二重出し防止
    if (roundPlayers && !roundPlayers.includes(playerId)) return; // ラウンド対象外

    const { next } = applyPlay({
      order: currentOrder,
      playerId,
      myNum,
    });

    const shouldFinish = shouldFinishAfterPlay({
      nextListLength: next.list.length,
      total: roundTotal ?? next.total ?? room?.order?.total ?? null,
      presenceCount: null,
      nextFailed: !!next.failed,
      allowContinue,
    });

    if (shouldFinish) {
      const success = !next.failed;
      const stats = applyOutcomeToRoomStats(
        room?.stats,
        success ? "success" : "failure"
      );
      // All games finish through reveal state for consistency
      tx.update(roomRef, {
        status: "reveal",
        order: next,
        result: { success, revealedAt: serverTimestamp() },
        stats,
        lastActiveAt: serverTimestamp(),
      });
      return;
    }

    // clue フェーズのまま order を更新して、全員に反映させる
    tx.update(roomRef, { order: next, lastActiveAt: serverTimestamp() });
  });
}

// 並び替えで一括判定モード: 提出された順序で昇順チェックし、結果を確定
export async function submitSortedOrder(roomId: string, list: string[]) {
  const _db = requireDb();
  await runTransaction(_db, async (tx) => {
    const roomRef = doc(_db, "rooms", roomId);
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) throw new Error("room not found");
    const room = roomSnap.data() as RoomDoc;
    const mode = normalizeResolveMode(room?.options?.resolveMode);
    const status: string = room?.status || "waiting";
    if (mode !== "sort-submit")
      throw new Error("このルームでは一括判定は無効です");
    if (status !== "clue") throw new Error("現在は提出できません");
    // 提出リストの妥当性チェック（重複/人数）
    const uniqueOk = new Set(list).size === list.length;
    if (!uniqueOk) throw new Error("提出リストに重複があります");
    const roundPlayers: string[] | null = Array.isArray(room?.deal?.players)
      ? (room.deal.players as string[])
      : null;
    const expected = roundPlayers ? roundPlayers.length : list.length;
    if (expected >= 2 && list.length !== expected) {
      throw new Error(`提出数が有効人数(${expected})と一致しません`);
    }
    if (roundPlayers) {
      const allMember = list.every((pid) => roundPlayers.includes(pid));
      if (!allMember) throw new Error("提出リストに対象外のプレイヤーが含まれています");
    }

    // プレイヤーの数字を取得して保存（リアルタイム判定で使用）
    let numbers: Record<string, number | null | undefined> = {};
    let numbersResolved = false;

    if (
      roundPlayers &&
      typeof room?.deal?.seed === "string" &&
      room.deal.seed
    ) {
      const min =
        typeof room?.deal?.min === "number" ? room.deal.min : 1;
      const max =
        typeof room?.deal?.max === "number" ? room.deal.max : 100;
      const generated = generateDeterministicNumbers(
        roundPlayers.length,
        min,
        max,
        String(room.deal.seed)
      );
      const deterministicMap: Record<string, number | null> = {};
      roundPlayers.forEach((pid, index) => {
        deterministicMap[pid] = generated[index] ?? null;
      });
      numbersResolved = list.every((pid) => pid in deterministicMap);
      if (numbersResolved) {
        numbers = list.reduce<Record<string, number | null | undefined>>(
          (acc, pid) => {
            acc[pid] = deterministicMap[pid] ?? null;
            return acc;
          },
          {}
        );
      }
    }

    if (!numbersResolved && room?.order?.numbers) {
      const existing = room.order.numbers;
      if (existing) {
        numbersResolved = list.every((pid) => pid in existing);
        if (numbersResolved) {
          numbers = list.reduce<Record<string, number | null | undefined>>(
            (acc, pid) => {
              acc[pid] = existing[pid] ?? null;
              return acc;
            },
            {}
          );
        }
      }
    }

    if (!numbersResolved) {
      const fetched: Record<string, number | null | undefined> = {};
      for (const pid of list) {
        const pSnap = await tx.get(doc(_db, "rooms", roomId, "players", pid));
        const playerData = pSnap.data() as PlayerDoc | undefined;
        fetched[pid] = playerData?.number;
      }
      numbers = fetched;
    }

    // サーバー側でも判定を行い、結果を保存
    const judgmentResult = evaluateSorted(list, numbers);
    const stats = applyOutcomeToRoomStats(
      room?.stats,
      judgmentResult.success ? "success" : "failure"
    );

    const order: RoomOrderState = {
      list,
      numbers, // プレイヤー数字を保存
      decidedAt: serverTimestamp(),
      total: expected,
      failed: !judgmentResult.success,
      failedAt: judgmentResult.failedAt,
      lastNumber: judgmentResult.last ?? null,
    };

    // アニメーションを挟むため status は一旦 "reveal" にする
    tx.update(roomRef, {
      status: "reveal",
      order,
      result: { success: judgmentResult.success, revealedAt: serverTimestamp() },
      stats,
      lastActiveAt: serverTimestamp(),
    });
  });
}

// reveal フェーズ完了後に最終確定 (UI のアニメーション完了イベントで呼ぶ)
export async function finalizeReveal(roomId: string) {
  const _db = requireDb();
  const roomRef = doc(_db, "rooms", roomId);
  await runTransaction(_db, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const room = snap.data() as RoomDoc;
    if (room.status !== "reveal") return; // 予期しない呼び出しは無視
    tx.update(roomRef, { status: "finished" });
  });
}
