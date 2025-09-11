import { sendSystemMessage } from "@/lib/firebase/chat";
import { db } from "@/lib/firebase/client";
import { fetchPresenceUids, presenceSupported } from "@/lib/firebase/presence";
import type { PlayerDoc, RoomOptions } from "@/lib/types";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
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
  // ホスト退室時: 次のホストを決定（オンライン優先）
  const playersSnap = await getDocs(
    collection(db!, "rooms", roomId, "players")
  );
  const all = playersSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  })) as (PlayerDoc & { id: string })[];
  const others = all.filter((p) => p.id !== userId);

  if (others.length > 0) {
    let nextHost = others[0].id;
    try {
      if (presenceSupported()) {
        const uids = await fetchPresenceUids(roomId);
        const online = others.find((p) => uids.includes(p.id));
        if (online) nextHost = online.id;
      }
    } catch {}
    await transferHost(roomId, nextHost);
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

  // ゲーム状態からも除去（カード待機エリア、並び順から削除）
  try {
    const roomRef = doc(db!, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    if (roomSnap.exists()) {
      const roomData = roomSnap.data() as any;
      let needsUpdate = false;
      const updates: any = {};

      // deal.players から削除
      if (roomData.deal?.players && Array.isArray(roomData.deal.players)) {
        const filteredPlayers = roomData.deal.players.filter((id: string) => id !== userId);
        if (filteredPlayers.length !== roomData.deal.players.length) {
          updates["deal.players"] = filteredPlayers;
          needsUpdate = true;
        }
      }

      // order.list から削除
      if (roomData.order?.list && Array.isArray(roomData.order.list)) {
        const filteredList = roomData.order.list.filter((id: string) => id !== userId);
        if (filteredList.length !== roomData.order.list.length) {
          updates["order.list"] = filteredList;
          needsUpdate = true;
        }
      }

      // order.proposal から削除
      if (roomData.order?.proposal && Array.isArray(roomData.order.proposal)) {
        const filteredProposal = roomData.order.proposal.filter((id: string) => id !== userId);
        if (filteredProposal.length !== roomData.order.proposal.length) {
          updates["order.proposal"] = filteredProposal;
          needsUpdate = true;
        }
      }

      // 更新が必要な場合のみ実行
      if (needsUpdate) {
        await updateDoc(roomRef, updates);
      }
    }
  } catch (error) {
    console.warn("Failed to update room state on leave:", error);
  }

  // 退出システムメッセージ（UTF-8）
  await sendSystemMessage(
    roomId,
    `${displayName || "匿名"} さんが退出しました`
  );
}

export async function resetRoomToWaiting(roomId: string) {
  await updateDoc(doc(db!, "rooms", roomId), {
    status: "waiting", // ラウンド終了後はロビー状態に戻す
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
    console.warn("resetRoomToWaiting: failed to reset players state", e);
  }
}
