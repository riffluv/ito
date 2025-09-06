import { db } from "@/lib/firebase/client";
import { fetchPresenceUids, presenceSupported } from "@/lib/firebase/presence";
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

export async function startGame(roomId: string) {
  const ref = doc(db!, "rooms", roomId);
  const snap = await getDoc(ref);
  const curr: any = snap.data();
  const next = nextStatusForEvent(curr?.status || "waiting", {
    type: "START_GAME",
  });
  if (!next) throw new Error("invalid transition: START_GAME");
  // 新ラウンド開始時は前ラウンドの order/result/deal をクリア
  await updateDoc(ref, { status: next, result: null, deal: null, order: null });
}

// ホストがトピック選択後に配札（重複なし）
export async function dealNumbers(roomId: string) {
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const snap = await getDocs(collection(db!, "rooms", roomId, "players"));
  const all: { id: string; uid?: string; lastSeen?: any }[] = [];
  snap.forEach((d) => all.push({ id: d.id, ...(d.data() as any) }));
  // presence優先でオンラインのみ配布。presence未対応時はlastSeenで近接を採用
  let target = all;
  try {
    if (presenceSupported()) {
      const uids = await fetchPresenceUids(roomId);
      if (Array.isArray(uids) && uids.length > 0) {
        const set = new Set(uids);
        target = all.filter((p) => set.has(p.id));
      } else {
        // presenceは利用可能だが空のときは lastSeen でフォールバック
        const now = Date.now();
        target = all.filter((p) =>
          isActive((p as any)?.lastSeen, now, ACTIVE_WINDOW_MS)
        );
      }
    } else {
      const now = Date.now();
      target = all.filter((p) =>
        isActive((p as any)?.lastSeen, now, ACTIVE_WINDOW_MS)
      );
    }
  } catch {
    // フォールバック: 取得失敗時は全員
    target = all;
  }
  const ordered = target.sort((a, b) =>
    String(a.uid || a.id).localeCompare(String(b.uid || b.id))
  );
  // 各自が自身のDocのみ更新できるルールに対応するため、部屋のdealに配布順のIDリストを保存
  await updateDoc(doc(db!, "rooms", roomId), {
    deal: { seed, min: 1, max: 100, players: ordered.map((p) => p.id) },
  });
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
  await updateDoc(ref, {
    status: "waiting",
    result: null,
    order: null,
    deal: null,
  });
}

export async function resetRoom(roomId: string) {
  const ref = doc(db!, "rooms", roomId);
  const snap = await getDoc(ref);
  const curr: any = snap.data();
  const next = nextStatusForEvent(curr?.status || "waiting", { type: "RESET" });
  if (!next) throw new Error("invalid transition: RESET");
  await updateDoc(ref, { status: next, result: null, deal: null, order: null });
}

// chooseAfterFail は不要（失敗後は自動継続または即終了）

// 並べ替え提案を保存（ルームの order.proposal に保存）
export async function setOrderProposal(roomId: string, proposal: string[]) {
  const _db = requireDb();
  await updateDoc(doc(_db, "rooms", roomId), { "order.proposal": proposal });
}

// sort-submit モード: プレイヤーが自分のカードを場(提案配列)に置く
export async function addCardToProposal(roomId: string, playerId: string) {
  const roomRef = doc(db!, "rooms", roomId);
  const playerRef = doc(db!, "rooms", roomId, "players", playerId);
  await runTransaction(db!, async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) throw new Error("room not found");
    const room: any = roomSnap.data();
    if (room.status !== "clue") return; // clue 中のみ
    if (room?.options?.resolveMode !== "sort-submit") return; // モード確認
    const pSnap = await tx.get(playerRef);
    if (!pSnap.exists()) throw new Error("player not found");
    const player: any = pSnap.data();
    if (typeof player.number !== "number") throw new Error("number not set");
    const current: string[] = room?.order?.proposal || [];
    if (current.includes(playerId)) return; // 重複防止
    const next = [...current, playerId];
    // order オブジェクトが未作成の場合の安全な merge
    tx.update(roomRef, {
      "order.proposal": next,
      order: { ...(room.order || {}), proposal: next },
    });
  });
}

// ドロップ時にクライアントが即時にカードを場に出して判定する（clue フェーズ用）
export async function commitPlayFromClue(roomId: string, playerId: string) {
  const roomRef = doc(db!, "rooms", roomId);
  const meRef = doc(db!, "rooms", roomId, "players", playerId);

  // presence count取得（可能なら）を先に行い、トランザクション内で参照する
  let presenceCount: number | null = null;
  try {
    if (presenceSupported()) {
      const uids = await fetchPresenceUids(roomId);
      if (Array.isArray(uids)) presenceCount = uids.length;
    }
  } catch {
    presenceCount = null;
  }

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

    const currentOrder = {
      list: room?.order?.list || [],
      lastNumber: room?.order?.lastNumber ?? null,
      failed: !!room?.order?.failed,
      failedAt: room?.order?.failedAt ?? null,
      decidedAt: room?.order?.decidedAt || serverTimestamp(),
      total: room?.order?.total ?? null,
    };

    if (currentOrder.list.includes(playerId)) return; // 二重出し防止

    const { next } = applyPlay({
      order: currentOrder as any,
      playerId,
      myNum,
      allowContinue,
    });

    const shouldFinish = shouldFinishAfterPlay({
      nextListLength: next.list.length,
      total: next.total ?? room?.order?.total ?? null,
      presenceCount,
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
      });
      return;
    }

    // clue フェーズのまま order を更新して、全員に反映させる
    tx.update(roomRef, { order: next });
  });
}

// 並び替えで一括判定モード: 提出された順序で昇順チェックし、結果を確定
export async function submitSortedOrder(roomId: string, list: string[]) {
  // サーバー側バリデーション: 実アクティブ人数を取得（可能ならpresence、不可なら後でdeal.playersで代替）
  let activeCount: number | null = null;
  try {
    if (presenceSupported()) {
      const uids = await fetchPresenceUids(roomId);
      if (Array.isArray(uids)) activeCount = uids.length;
    }
  } catch {
    activeCount = null;
  }

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
    const expected =
      typeof activeCount === "number"
        ? activeCount
        : Array.isArray(room?.deal?.players)
          ? (room.deal.players as string[]).length
          : list.length;
    if (expected >= 2 && list.length !== expected) {
      throw new Error(`提出数が有効人数(${expected})と一致しません`);
    }
    
    // プレイヤーの数字を取得して保存（リアルタイム判定で使用）
    const numbers: Record<string, number | null | undefined> = {};
    for (const pid of list) {
      const pSnap = await tx.get(doc(_db, "rooms", roomId, "players", pid));
      numbers[pid] = (pSnap.data() as any)?.number;
    }
    
    const order = {
      list,
      numbers, // プレイヤー数字を保存
      decidedAt: serverTimestamp(),
      total: list.length,
      // リアルタイム判定のため事前計算は行わない
    } as any;

    // アニメーションを挟むため status は一旦 "reveal" にする
    tx.update(roomRef, {
      status: "reveal",
      order,
      // result は初期化しない - リアルタイム判定で設定
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
