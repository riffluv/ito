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

const ROOM_TTL_MS = 60 * 60 * 1000; // 60����Ɏ����폜���������ꍇ�̖ڈ�

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
  // �Q���҈ꗗ����z�X�g�ڏ��������
  const playersSnap = await getDocs(collection(db!, "rooms", roomId, "players"));
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

  // ������ގ��i�d��Doc���܂߂ĉ\�Ȍ���폜�j
  try {
    const dupQ = query(
      collection(db!, "rooms", roomId, "players"),
      where("uid", "==", userId)
    );
    const dupSnap = await getDocs(dupQ);
    const ids = new Set<string>(dupSnap.docs.map((d) => d.id));
    ids.add(userId); // ��L�[�̃h�L�������g������
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

  // �ގ����O�isystem�j
  await addDoc(collection(db!, "rooms", roomId, "chat"), {
    sender: "system",
    text: `${displayName || "����"} ���ޏo���܂���`,
    createdAt: serverTimestamp(),
  });
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

