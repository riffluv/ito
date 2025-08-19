import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { applyPlay, defaultOrderState } from "@/lib/game/rules";
// 乱数はクライアントで自分の番号計算に使用

export async function startGame(roomId: string) {
  await updateDoc(doc(db, "rooms", roomId), {
    status: "clue",
    result: null,
    deal: null,
  });
}

// ホストがトピック選択後に配札（重複なし）
export async function dealNumbers(roomId: string) {
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const snap = await getDocs(collection(db, "rooms", roomId, "players"));
  const players: { id: string; uid?: string }[] = [];
  snap.forEach((d) => players.push({ id: d.id, ...(d.data() as any) }));
  const ordered = players.sort((a, b) => (String(a.uid || a.id)).localeCompare(String(b.uid || b.id)));
  // 各自が自身のDocのみ更新できるルールに対応するため、部屋のdealに配布順のIDリストを保存
  await updateDoc(doc(db, "rooms", roomId), {
    deal: { seed, min: 1, max: 100, players: ordered.map(p => p.id) }
  });
}

// finalizeOrder（公開順演出）は現行フローでは未使用

export async function finishRoom(roomId: string, success: boolean) {
  await updateDoc(doc(db, "rooms", roomId), {
    status: "finished",
    result: { success, revealedAt: serverTimestamp() },
  });
}

export async function continueAfterFail(roomId: string) {
  await updateDoc(doc(db, "rooms", roomId), {
    status: "clue",
    result: null,
  });
}

export async function resetRoom(roomId: string) {
  await updateDoc(doc(db, "rooms", roomId), {
    status: "waiting",
    result: null,
    deal: null,
  });
}

// 順番出し方式の開始（ホストが実行）
export async function startPlaying(roomId: string) {
  let total: number | null = null;
  try {
    const r = await getDoc(doc(db, "rooms", roomId));
    const data: any = r.data();
    const arr = data?.deal?.players;
    if (Array.isArray(arr)) total = arr.length;
    if (total === null) {
      const snap = await getDocs(collection(db, "rooms", roomId, "players"));
      total = snap.size;
    }
  } catch {}
  await updateDoc(doc(db, "rooms", roomId), {
    status: "playing",
    order: { ...defaultOrderState(), decidedAt: serverTimestamp(), total },
    result: null,
  });
}

// 自分のカードを場に出す（昇順チェックを行い、失敗なら即終了）
export async function playCard(roomId: string, playerId: string) {
  const roomRef = doc(db, "rooms", roomId);
  const meRef = doc(db, "rooms", roomId, "players", playerId);
  await runTransaction(db, async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) throw new Error("room not found");
    const room: any = roomSnap.data();
    if (room.status !== "playing") return;
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

    const { next } = applyPlay({ order: currentOrder as any, playerId, myNum, allowContinue });

    const total = typeof next.total === "number" ? next.total : null;
    const isAllPlayed = total !== null && next.list.length === total;

    if (next.failed && !allowContinue) {
      tx.update(roomRef, { status: "finished", order: next, result: { success: false, revealedAt: serverTimestamp() } });
      return;
    }

    if (isAllPlayed) {
      const success = !next.failed;
      tx.update(roomRef, { status: "finished", order: next, result: { success, revealedAt: serverTimestamp() } });
      return;
    }

    tx.update(roomRef, { order: next });
  });
}

// chooseAfterFail は不要（失敗後は自動継続または即終了）
