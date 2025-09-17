import { sendSystemMessage } from "@/lib/firebase/chat";
import { db } from "@/lib/firebase/client";
import { fetchPresenceUids, presenceSupported } from "@/lib/firebase/presence";
import { logWarn } from "@/lib/utils/log";
import type { PlayerDoc, RoomOptions } from "@/lib/types";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const ROOM_TTL_MS = 60 * 60 * 1000; // 60分で自動削除（未使用時のTTL想定）

export async function setRoomOptions(roomId: string, options: RoomOptions) {
  await updateDoc(doc(db!, "rooms", roomId), { options });
}

export async function updateLastActive(roomId: string) {
  await updateDoc(doc(db!, "rooms", roomId), {
    lastActiveAt: serverTimestamp(),
  });
}

export async function transferHost(roomId: string, newHostId: string) {
  await updateDoc(doc(db!, "rooms", roomId), { hostId: newHostId });
}

export async function leaveRoom(
  roomId: string,
  userId: string,
  displayName: string | null | undefined
) {
  // Presence クリーンアップを先に実行（ベストプラクティス）
  try {
    if (presenceSupported()) {
      const { forceDetachAll } = await import("@/lib/firebase/presence");
      await forceDetachAll(roomId, userId);
    }
  } catch {
    // Presence 削除失敗は無視（他の処理を継続）
  }
  // プレイヤーDoc重複安全削除
  try {
    const dupQ = query(
      collection(db!, "rooms", roomId, "players"),
      where("uid", "==", userId)
    );
    const dupSnap = await getDocs(dupQ);
    const ids = new Set<string>(dupSnap.docs.map((d) => d.id));
    ids.add(userId); // 元UIDの doc も確実に削除
    await Promise.all(
      Array.from(ids).map(async (id) => {
        try {
          await deleteDoc(doc(db!, "rooms", roomId, "players", id));
        } catch {}
      })
    );
  } catch {
    try {
      await deleteDoc(doc(db!, "rooms", roomId, "players", userId));
    } catch {}
  }

  // ゲーム状態からも除去（カード待機エリア、並び順から削除）およびホスト委譲をトランザクションで原子的に実施
  let transferredTo: string | null = null;
  try {
    const roomRef = doc(db!, "rooms", roomId);
    await runTransaction(db!, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) return;
      const roomData = snap.data() as any;

      // deal.players フィルタ
      const origPlayers: string[] = Array.isArray(roomData?.deal?.players)
        ? (roomData.deal.players as string[])
        : [];
      const filteredPlayers = origPlayers.filter((id) => id !== userId);

      // order.* フィルタ
      const origList: string[] = Array.isArray(roomData?.order?.list)
        ? (roomData.order.list as string[])
        : [];
      const origProposal: (string | null)[] = Array.isArray(roomData?.order?.proposal)
        ? (roomData.order.proposal as (string | null)[])
        : [];
      const filteredList = origList.filter((id) => id !== userId);
      const filteredProposal = origProposal.filter((id) => id !== userId);

      // ホスト委譲（他に誰かいれば）
      if (roomData.hostId === userId) {
        let nextHost: string | null = null;
        if (filteredPlayers.length > 0) {
          nextHost = filteredPlayers[0];
          try {
            if (presenceSupported()) {
              const uids = await fetchPresenceUids(roomId);
              const online = filteredPlayers.find((id) => uids.includes(id));
              if (online) nextHost = online;
            }
          } catch {}
        }
        if (nextHost) {
          tx.update(roomRef, { hostId: nextHost });
          transferredTo = nextHost;
        }
      }

      const updates: any = {};
      if (origPlayers.length !== filteredPlayers.length) {
        updates["deal.players"] = filteredPlayers;
        updates["order.total"] = filteredPlayers.length;
      }
      if (origList.length !== filteredList.length) {
        updates["order.list"] = filteredList;
      }
      if (origProposal.length !== filteredProposal.length) {
        updates["order.proposal"] = filteredProposal;
      }
      if (Object.keys(updates).length > 0) tx.update(roomRef, updates);
    });
  } catch (error) {
    logWarn("rooms", "leave-room-update-failed", error);
  }

  // 退出システムメッセージ（UTF-8）
  await sendSystemMessage(
    roomId,
    `${displayName || "匿名"} さんが退出しました`
  );

  // ホスト委譲が発生した場合は告知
  if (transferredTo) {
    try {
      // UIDではなく表示名を取得して告知
      let nextHostName: string = transferredTo || "";
      try {
        const pSnap = await getDoc(doc(db!, "rooms", roomId, "players", transferredTo));
        const nm = (pSnap.data() as any)?.name;
        if (typeof nm === "string" && nm.trim()) nextHostName = nm.trim();
      } catch {}
      await sendSystemMessage(roomId, `👑 ホストが ${nextHostName} さんに委譲されました`);
    } catch {}
  } else {
    // ホスト委譲が失敗した場合のフォールバック：他のプレイヤーがいるかチェック
    try {
      const playersSnap = await getDocs(collection(db!, "rooms", roomId, "players"));
      const others = playersSnap.docs.map((d) => d.id).filter((id) => id !== userId);

      if (others.length > 0) {
        // 他のプレイヤーがいる場合：ホスト委譲
        let nextHost = others[0];
        try {
          if (presenceSupported()) {
            const uids = await fetchPresenceUids(roomId);
            const online = others.find((id) => uids.includes(id));
            if (online) nextHost = online;
          }
        } catch {}
        await updateDoc(doc(db!, "rooms", roomId), {
          hostId: nextHost,
        });
        try {
          // UIDではなく表示名を取得して告知
          let nextHostName: string = nextHost || "";
          try {
            const pSnap = await getDoc(doc(db!, "rooms", roomId, "players", nextHost));
            const nm = (pSnap.data() as any)?.name;
            if (typeof nm === "string" && nm.trim()) nextHostName = nm.trim();
          } catch {}
          await sendSystemMessage(roomId, `👑 ホストが ${nextHostName} さんに委譲されました`);
        } catch {}
      } else {
        // 誰もいなくなった場合：部屋を待機状態にリセット（開かずの扉問題を防ぐ）
        try {
          await resetRoomToWaiting(roomId, { force: true });
          await sendSystemMessage(roomId, "🔄 部屋が空になったため、ゲーム状態をリセットしました");
        } catch (error) {
          logWarn("rooms", "auto-reset-empty-room-failed", error);
        }
      }
    } catch (error) {
      logWarn("rooms", "leave-room-fallback-failed", error);
    }
  }
}

export async function resetRoomToWaiting(roomId: string, opts?: { force?: boolean }) {
  const roomRef = doc(db!, "rooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  const room: any = snap.data();
  const status = room?.status;
  // 進行中は原則禁止（誤タップや遅延UIからの誤操作防止）
  if (!opts?.force && (status === "clue" || status === "reveal")) {
    throw new Error("進行中はリセットできません");
  }
  await updateDoc(roomRef, {
    status: "waiting",
    result: null,
    deal: null,
    order: null,
    round: 0,
    topic: null,
    topicOptions: null,
    topicBox: null,
    closedAt: null,
    expiresAt: null,
  });

  // 参加者の一時状態も初期化（ホスト操作時に全員分を安全にクリア）
  try {
    const playersRef = collection(db!, "rooms", roomId, "players");
    const snap = await getDocs(playersRef);
    const batch = writeBatch(db!);
    snap.forEach((d) => {
      batch.update(d.ref, {
        number: null,
        clue1: "",
        ready: false,
        orderIndex: 0,
      });
    });
    await batch.commit();
  } catch (e) {
    // クリア失敗は致命的ではないためログのみに留める
    logWarn("rooms", "reset-room-reset-players-failed", e);
  }
}

// リセット＋在席者のみでやり直し（チャット告知オプション）
export async function resetRoomWithPrune(
  roomId: string,
  keepIds: string[] | null | undefined,
  opts?: { notifyChat?: boolean }
) {
  const roomRef = doc(db!, "rooms", roomId);
  let removedCount: number | null = null;
  let keptCount: number | null = null;
  let prevTotal: number | null = null;
  await runTransaction(db!, async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists()) return;
    const room: any = snap.data();
    const prevRound: string[] | null = Array.isArray(room?.deal?.players)
      ? (room.deal.players as string[])
      : null;
    const keepArr = Array.isArray(keepIds) ? keepIds : [];
    if (prevRound && prevRound.length > 0) {
      prevTotal = prevRound.length;
      const keep = new Set(keepArr);
      keptCount = prevRound.filter((id) => keep.has(id)).length;
      removedCount = prevTotal - keptCount;
    } else {
      // 前ラウンドが存在しない（waiting中など）の場合は、在席数のみを表示用に保持
      prevTotal = null;
      keptCount = keepArr.length;
      removedCount = null;
    }
    // リセット本体
    tx.update(roomRef, {
      status: "waiting",
      result: null,
      deal: null,
      order: null,
      round: 0,
      topic: null,
      topicOptions: null,
      topicBox: null,
      closedAt: null,
      expiresAt: null,
    });
  });

  // プレイヤーの連想ワードと状態もクリア（「リセット」ボタン用）
  try {
    console.log("🔥 resetRoomWithPrune: プレイヤー状態クリア開始", roomId);
    const playersRef = collection(db!, "rooms", roomId, "players");
    const snap = await getDocs(playersRef);
    const batch = writeBatch(db!);
    let updateCount = 0;
    snap.forEach((d) => {
      batch.update(d.ref, {
        number: null,
        clue1: "", // 🚨 連想ワードをクリア
        ready: false,
        orderIndex: 0,
      });
      updateCount++;
    });
    await batch.commit();
    console.log("✅ resetRoomWithPrune: プレイヤー状態クリア完了", { roomId, updateCount });
  } catch (e) {
    console.error("❌ resetRoomWithPrune: プレイヤー状態クリア失敗", e);
    logWarn("rooms", "reset-room-with-prune-players-failed", e);
  }

  // 任意のチャット告知（軽量）
  // チャット告知は「だれかを除外した」ときのみ（連投で会話を圧迫しないため）
  if (opts?.notifyChat && removedCount != null && removedCount > 0) {
    try {
      const kept = keptCount ?? 0;
      const prev = prevTotal ?? kept + removedCount;
      await sendSystemMessage(
        roomId,
        `🔄 在席者でやり直し（前ラウンド ${prev} 名 → 在席 ${kept} 名、除外 ${removedCount} 名）`
      );
    } catch {}
  }
}
