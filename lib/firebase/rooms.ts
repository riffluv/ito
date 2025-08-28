import { sendSystemMessage } from "@/lib/firebase/chat";
import { db } from "@/lib/firebase/client";
import { fetchPresenceUids, presenceSupported } from "@/lib/firebase/presence";
import type { PlayerDoc, RoomOptions } from "@/lib/types";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
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
}
