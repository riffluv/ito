import { db } from "@/lib/firebase/client";
import { fetchPresenceUids, presenceSupported } from "@/lib/firebase/presence";
import { sendSystemMessage } from "@/lib/firebase/chat";
import { sendNotifyEvent } from "@/lib/firebase/events";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
import { requireDb } from "@/lib/firebase/require";
import { normalizeResolveMode } from "@/lib/game/resolveMode";
import {
  applyPlay,
  evaluateSorted,
  shouldFinishAfterPlay,
} from "@/lib/game/rules";
import { nextStatusForEvent } from "@/lib/state/guards";
import { ACTIVE_WINDOW_MS, isActive } from "@/lib/time";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
// 乱数はクライアントで自分の番号計算に使用

// 通知ブロードキャスト関数
async function broadcastNotify(
  roomId: string,
  type: "info" | "warning" | "success" | "error",
  title: string,
  description?: string
) {
  try {
    await sendNotifyEvent(roomId, { type, title, description });
  } catch {
    // ignore broadcast failure
  }
}

export async function startGame(roomId: string) {
  const ref = doc(db!, "rooms", roomId);
  const snap = await getDoc(ref);
  const curr: any = snap.data();
  const currentStatus = curr?.status || "waiting";
  // 進行中や終了直後からの誤開始を防止（必ずwaitingからのみ開始）
  if (currentStatus !== "waiting") {
    throw new Error("開始できるのは待機中のみです");
  }
  // 新ラウンド開始時は前ラウンドの order/result/deal をクリア
  await updateDoc(ref, {
    status: "clue",
    result: null,
    deal: null,
    order: null,
    lastActiveAt: serverTimestamp(),
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
    await broadcastNotify(roomId, "success", "ゲームを開始しました", "連想ワードを入力してください");
  } catch {
    // 通知失敗は無視
  }
}

// ホストがトピック選択後に配札（重複なし）
export async function dealNumbers(roomId: string): Promise<number> {
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const snap = await getDocs(collection(db!, "rooms", roomId, "players"));
  const all: { id: string; uid?: string; lastSeen?: any }[] = [];
  snap.forEach((d) => all.push({ id: d.id, ...(d.data() as any) }));
  const now = Date.now();
  const activeByRecency = all.filter((p) =>
    isActive((p as any)?.lastSeen, now, ACTIVE_WINDOW_MS)
  );
  // presence優先でオンラインのみ配布。presence未対応時はlastSeenで近接を採用
  let target = all;
  try {
    if (presenceSupported()) {
      const uids = await fetchPresenceUids(roomId);
      if (Array.isArray(uids) && uids.length > 0) {
        const set = new Set(uids);
        const filtered = all.filter((p) => set.has(p.id));
        target = filtered.length > 0
          ? filtered
          : activeByRecency.length > 0
            ? activeByRecency
            : all;
      } else {
        target = activeByRecency.length > 0 ? activeByRecency : all;
      }
    } else {
      target = activeByRecency.length > 0 ? activeByRecency : all;
    }
  } catch {
    target = activeByRecency.length > 0 ? activeByRecency : all;
  }
  if (!target.length) {
    target = activeByRecency.length > 0 ? activeByRecency : all;
  }
  if (target.length < Math.min(2, all.length)) {
    target = all;
  }
  const ordered = target.sort((a, b) =>
    String(a.uid || a.id).localeCompare(String(b.uid || b.id))
  );
  // 各自が自身のDocのみ更新できるルールに対応するため、部屋のdealに配布順のIDリストを保存
  await updateDoc(doc(db!, "rooms", roomId), {
    deal: { seed, min: 1, max: 100, players: ordered.map((p) => p.id) },
    "order.total": ordered.length,
    lastActiveAt: serverTimestamp(),
  });
  return ordered.length;
}

// finalizeOrder（公開順演出）は現行フローでは未使用

export async function finishRoom(roomId: string, success: boolean) {
  const ref = doc(db!, "rooms", roomId);
  const snap = await getDoc(ref);
  const curr: any = snap.data();
  const next = nextStatusForEvent(curr?.status || "waiting", {
    type: "FINISH",
  });
  if (!next) throw new Error("invalid transition: FINISH");
  await updateDoc(ref, {
    status: next,
    result: { success, revealedAt: serverTimestamp() },
  });
}

export async function continueAfterFail(roomId: string) {
  // 次ラウンドへ進む前に waiting に戻す（お題/配札はホストの開始操作で行う）
  const ref = doc(db!, "rooms", roomId);
  const snap = await getDoc(ref);
  const curr: any = snap.data();
  // 誤操作防止: reveal/finished 以外では実行不可
  if (curr?.status !== "reveal" && curr?.status !== "finished") {
    throw new Error("進行中は継続できません");
  }
  await updateDoc(ref, {
    status: "waiting",
    result: null,
    order: null,
    deal: null,
    lastActiveAt: serverTimestamp(),
  });
  // waiting に戻るタイミングでプレイヤーの連想/readyも即時クリア
  try {
    console.log("🔥 continueAfterFail: プレイヤー状態クリア開始", roomId);
    const { collection, getDocs, writeBatch } = await import("firebase/firestore");
    const playersRef = collection(db!, "rooms", roomId, "players");
    const ps = await getDocs(playersRef);
    const batch = writeBatch(db!);
    let updateCount = 0;
    ps.forEach((d) => {
      batch.update(d.ref, { clue1: "", ready: false, number: null, orderIndex: 0 });
      updateCount++;
    });
    await batch.commit();
    console.log("✅ continueAfterFail: プレイヤー状態クリア完了", { roomId, updateCount });
  } catch (e) {
    console.error("❌ continueAfterFail: プレイヤー状態クリア失敗", e);
  }
}

export async function resetRoom(roomId: string) {
  const ref = doc(db!, "rooms", roomId);
  const snap = await getDoc(ref);
  const curr: any = snap.data();
  const next = nextStatusForEvent(curr?.status || "waiting", { type: "RESET" });
  if (!next) throw new Error("invalid transition: RESET");
  await updateDoc(ref, { status: next, result: null, deal: null, order: null, lastActiveAt: serverTimestamp() });
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
  await updateDoc(doc(_db, "rooms", roomId), { "order.proposal": proposal });
}

// sort-submit モード: プレイヤーが自分のカードを場(提案配列)に置く
// 既存の末尾追加機能（「出す」ボタン用）
export async function addCardToProposal(roomId: string, playerId: string) {
  return addCardToProposalAtPosition(roomId, playerId, -1); // -1 = 末尾追加
}

// 新機能：位置指定でカード追加（WaitingCardドラッグ用）
export async function addCardToProposalAtPosition(
  roomId: string,
  playerId: string,
  targetIndex: number = -1
) {
  const roomRef = doc(db!, "rooms", roomId);
  const playerRef = doc(db!, "rooms", roomId, "players", playerId);
  await runTransaction(db!, async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) throw new Error("room not found");
    const room: any = roomSnap.data();
    if (room.status !== "clue") return; // clue 中のみ
    if (room?.options?.resolveMode !== "sort-submit") return; // モード確認
    const roundPlayers: string[] | null = Array.isArray(room?.deal?.players)
      ? (room.deal.players as string[])
      : null;
    if (!roundPlayers || roundPlayers.length === 0) return; // 未配札
    const pSnap = await tx.get(playerRef);
    if (!pSnap.exists()) throw new Error("player not found");
    const player: any = pSnap.data();
    if (typeof player.number !== "number") throw new Error("number not set");
    if (!roundPlayers.includes(playerId)) return; // このラウンドの対象外
    const current: string[] = room?.order?.proposal || [];
    if (current.includes(playerId)) return; // 重複防止

    let next: any[];
    const maxCount: number = Array.isArray(room?.deal?.players)
      ? (room.deal.players as string[]).length
      : 0;
    if (maxCount <= 0) return; // 未配札時は受け付けない
    // 上限が0になるケースはない想定だが、保険で0を許容
    if (targetIndex === -1) {
      // 末尾追加（既存の「出す」ボタン動作）
      next = [...current];
      // 空き（null）優先で詰める
      let placed = false;
      for (let i = 0; i < Math.max(next.length, maxCount); i++) {
        if (i >= next.length) next.length = i + 1;
        if (next[i] == null) {
          next[i] = playerId;
          placed = true;
          break;
        }
      }
      if (!placed) next.push(playerId);
    } else {
      // 位置指定追加: 配列長が不足していれば null でパディングし、指定位置にセット
      next = [...current];
      const clamped = Math.max(
        0,
        Math.min(targetIndex, Math.max(0, maxCount - 1))
      );
      if (clamped < next.length) {
        // 既に何かがある位置には置かない（UI側で空きスロットのみ許容している想定）
        if (typeof next[clamped] === "string" && next[clamped]) {
          return;
        }
      } else {
        // 長さを広げ（未定義をnullに正規化する）
        (next as any).length = clamped + 1;
      }
      next[clamped] = playerId;
      next = next.map((v) => (v === undefined ? null : v));
    }
    // 配列を最大人数に合わせて切り詰め
    if (maxCount > 0) {
      if (next.length > maxCount) next.length = maxCount;
      // 長さ不足はnullでパディング
      if (next.length < maxCount) {
        const pad = new Array(maxCount - next.length).fill(null);
        next = [...next, ...pad];
      }
    }

    // order オブジェクトが未作成の場合の安全な merge
    tx.update(roomRef, {
      "order.proposal": next,
      order: { ...(room.order || {}), proposal: next },
      lastActiveAt: serverTimestamp(),
    });
  });
}

// 既にproposalに含まれるカードを、空きスロットに移動（重複防止）。
export async function moveCardInProposalToPosition(
  roomId: string,
  playerId: string,
  targetIndex: number
) {
  const roomRef = doc(db!, "rooms", roomId);
  await runTransaction(db!, async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) throw new Error("room not found");
    const room: any = roomSnap.data();
    if (room.status !== "clue") return;
    if (room?.options?.resolveMode !== "sort-submit") return;
    const roundPlayers: string[] | null = Array.isArray(room?.deal?.players)
      ? (room.deal.players as string[])
      : null;
    if (!roundPlayers || roundPlayers.length === 0) return;
    if (!roundPlayers.includes(playerId)) return;
    const current: any[] = (room?.order?.proposal || []).slice();
    const maxCount: number = Array.isArray(room?.deal?.players)
      ? (room.deal.players as string[]).length
      : 0;
    if (maxCount <= 0) return;

    const fromIdx = current.findIndex((v) => v === playerId);
    if (fromIdx < 0) return; // まだ出ていない

    const clamped = Math.max(
      0,
      Math.min(targetIndex, Math.max(0, maxCount - 1))
    );

    // ベストプラクティス: シンプルで信頼性の高い配列移動ロジック
    if (current[clamped] && current[clamped] !== playerId) {
      // 目標位置に他のカードがある場合は入れ替え（swap）
      const targetCard = current[clamped];
      current[clamped] = playerId;
      current[fromIdx] = targetCard;
    } else {
      // 目標位置が空きまたは自分の場合は単純移動
      current[fromIdx] = null;
      if (clamped >= current.length) (current as any).length = clamped + 1;
      current[clamped] = playerId;
    }

    // 長さ調整
    if (maxCount > 0) {
      if (current.length > maxCount) current.length = maxCount;
      if (current.length < maxCount) {
        const pad = new Array(maxCount - current.length).fill(null);
        current.push(...pad);
      }
    }

    const normalized = current.map((v) => (v === undefined ? null : v));
    tx.update(roomRef, {
      "order.proposal": normalized,
      order: { ...(room.order || {}), proposal: normalized },
      lastActiveAt: serverTimestamp(),
    });
  });
}

// ドロップ時にクライアントが即時にカードを場に出して判定する（clue フェーズ用）
export async function commitPlayFromClue(roomId: string, playerId: string) {
  const roomRef = doc(db!, "rooms", roomId);
  const meRef = doc(db!, "rooms", roomId, "players", playerId);

  // 終了判定は配札済みの参加者数（deal.players）に基づくため、presenceは参照しない
  let presenceCount: number | null = null;

  await runTransaction(db!, async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) throw new Error("room not found");
    const room: any = roomSnap.data();
    // clue フェーズ（または legacy playing）でのみ即時判定を受け付ける
    if (room.status !== "clue" && room.status !== "playing") return;
    const allowContinue: boolean = !!room?.options?.allowContinueAfterFail;

    const meSnap = await tx.get(meRef);
    if (!meSnap.exists()) throw new Error("player not found");
    const me: any = meSnap.data();
    const myNum: number | null = me?.number ?? null;
    if (typeof myNum !== "number") throw new Error("number not set");

    const roundPlayers: string[] | null = Array.isArray(room?.deal?.players)
      ? (room.deal.players as string[])
      : null;
    const roundTotal: number | null = roundPlayers ? roundPlayers.length : null;
    const currentOrder = {
      list: room?.order?.list || [],
      lastNumber: room?.order?.lastNumber ?? null,
      failed: !!room?.order?.failed,
      failedAt: room?.order?.failedAt ?? null,
      decidedAt: room?.order?.decidedAt || serverTimestamp(),
      total: roundTotal ?? room?.order?.total ?? null,
    };

    if (currentOrder.list.includes(playerId)) return; // 二重出し防止
    if (roundPlayers && !roundPlayers.includes(playerId)) return; // ラウンド対象外

    const { next } = applyPlay({
      order: currentOrder as any,
      playerId,
      myNum,
      allowContinue,
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
      // All games finish through reveal state for consistency
      tx.update(roomRef, {
        status: "reveal",
        order: next,
        result: { success, revealedAt: serverTimestamp() },
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
    const room: any = roomSnap.data();
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
    const numbers: Record<string, number | null | undefined> = {};
    for (const pid of list) {
      const pSnap = await tx.get(doc(_db, "rooms", roomId, "players", pid));
      numbers[pid] = (pSnap.data() as any)?.number;
    }

    // サーバー側でも判定を行い、結果を保存
    const judgmentResult = evaluateSorted(list, numbers);

    const order = {
      list,
      numbers, // プレイヤー数字を保存
      decidedAt: serverTimestamp(),
      total: expected,
      failed: !judgmentResult.success,
      failedAt: judgmentResult.failedAt,
    } as any;

    // アニメーションを挟むため status は一旦 "reveal" にする
    // result は useRevealAnimation で遅延設定されるため、ここでは設定しない
    tx.update(roomRef, {
      status: "reveal",
      order,
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
    const room: any = snap.data();
    if (room.status !== "reveal") return; // 予期しない呼び出しは無視
    tx.update(roomRef, { status: "finished" });
  });
}
