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

      const updates: any = { lastActiveAt: serverTimestamp() };
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
    console.warn("Failed to update room state on leave:", error);
  }

  // 退出システムメッセージ（UTF-8）
  await sendSystemMessage(
    roomId,
    `${displayName || "匿名"} さんが退出しました`
  );

  // ホスト委譲が発生した場合は告知
  if (transferredTo) {
    try {
      await sendSystemMessage(roomId, `👑 ホストが ${transferredTo} さんに委譲されました`);
    } catch {}
  }
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
