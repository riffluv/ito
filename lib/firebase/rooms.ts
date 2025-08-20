import { db } from "@/lib/firebase/client";
import { fetchPresenceUids, presenceSupported } from "@/lib/firebase/presence";
import type { PlayerDoc, RoomOptions } from "@/lib/types";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

const ROOM_TTL_MS = 60 * 60 * 1000; // 60分後に自動削除させたい場合の目安

export async function setRoomOptions(roomId: string, options: RoomOptions) {
  await updateDoc(doc(db, "rooms", roomId), { options });
}

export async function updateLastActive(roomId: string) {
  await updateDoc(doc(db, "rooms", roomId), {
    lastActiveAt: serverTimestamp(),
  });
}

export async function transferHost(roomId: string, newHostId: string) {
  await updateDoc(doc(db, "rooms", roomId), { hostId: newHostId });
}

export async function leaveRoom(
  roomId: string,
  userId: string,
  displayName: string | null | undefined
) {
  // 参加者一覧からホスト移譲先を決定
  const playersSnap = await getDocs(collection(db, "rooms", roomId, "players"));
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

  // 自分を退室（重複Docも含めて可能な限り削除）
  try {
    const dupQ = query(
      collection(db, "rooms", roomId, "players"),
      where("uid", "==", userId)
    );
    const dupSnap = await getDocs(dupQ);
    const ids = new Set<string>(dupSnap.docs.map((d) => d.id));
    ids.add(userId); // 主キーのドキュメントも試す
    await Promise.all(
      Array.from(ids).map(async (id) => {
        try {
          await deleteDoc(doc(db, "rooms", roomId, "players", id));
        } catch {}
      })
    );
  } catch {
    try {
      await deleteDoc(doc(db, "rooms", roomId, "players", userId));
    } catch {}
  }

  await updateLastActive(roomId);
  await addDoc(collection(db, "rooms", roomId, "chat"), {
    sender: "system",
    text: `${displayName || "匿名"} が退出しました`,
    createdAt: serverTimestamp(),
  });

  // 最後の1人が抜けたらソフトクローズ（ロビーに出さない）かつ待機へ戻す
  try {
    const remain = await getDocs(collection(db, "rooms", roomId, "players"));
    if (remain.empty) {
      // 状態と一時データをクリア
      await resetRoomToWaiting(roomId);
      await updateDoc(doc(db, "rooms", roomId), {
        closedAt: serverTimestamp(),
      });
    }
  } catch {}

  // 残り参加者がいなければソフトクローズ
  const afterSnap = await getDocs(collection(db, "rooms", roomId, "players"));
  const remaining = afterSnap.size;
  if (remaining === 0) {
    const expires = new Date(Date.now() + ROOM_TTL_MS);
    await updateDoc(doc(db, "rooms", roomId), {
      closedAt: serverTimestamp(),
      expiresAt: expires,
      lastActiveAt: serverTimestamp(),
    });
  }
}

export async function resetRoomToWaiting(roomId: string) {
  await updateDoc(doc(db, "rooms", roomId), {
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
}
