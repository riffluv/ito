import { db } from "@/lib/firebase/client";
import { hashString } from "@/lib/game/random";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { randomAvatar } from "@/lib/utils";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

export async function ensureMember({
  roomId,
  uid,
  displayName,
}: {
  roomId: string;
  uid: string;
  displayName: string | null | undefined;
}): Promise<{ joined: boolean } | { joined: false }> {
  const meRef = doc(db!, "rooms", roomId, "players", uid);
  const meSnap = await getDoc(meRef);
  if (!meSnap.exists()) {
    const p: PlayerDoc = {
      name: displayName || "匿名",
      avatar: randomAvatar(displayName || uid.slice(0, 6)),
      number: null,
      clue1: "",
      ready: false,
      orderIndex: 0,
      uid,
      lastSeen: serverTimestamp(),
    };
    await setDoc(meRef, p);
    return { joined: true } as const;
  }
  return { joined: false } as const;
}

export async function cleanupDuplicatePlayerDocs(roomId: string, uid: string) {
    const dupQ = query(
      collection(db!, "rooms", roomId, "players"),
      where("uid", "==", uid)
    );
  const dupSnap = await getDocs(dupQ);
  for (const d of dupSnap.docs) {
    if (d.id !== uid) {
      try {
        await deleteDoc(doc(db!, "rooms", roomId, "players", d.id));
      } catch {}
    }
  }
}

export async function addLateJoinerToDeal(roomId: string, uid: string) {
  const roomRef = doc(db!, "rooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;
  const data = snap.data() as RoomDoc & any;
  const deal = data?.deal || null;
  const playersArr: string[] = Array.isArray(deal?.players)
    ? (deal.players as string[])
    : [];
  if (!playersArr.includes(uid)) playersArr.push(uid);

  const patch: any = { deal: { ...(deal || {}), players: playersArr } };
  if (data?.status === "clue") {
    const total =
      typeof data?.order?.total === "number"
        ? data.order.total + 1
        : playersArr.length;
    patch.order = { ...(data?.order || {}), total };
  }
  await updateDoc(roomRef, patch);
}

export async function assignNumberIfNeeded(roomId: string, uid: string) {
  const roomRef = doc(db!, "rooms", roomId);
  const [roomSnap, meSnap] = await Promise.all([
    getDoc(roomRef),
    getDoc(doc(db!, "rooms", roomId, "players", uid)),
  ]);
  if (!roomSnap.exists() || !meSnap.exists()) return;
  const room: any = roomSnap.data();
  const me: any = meSnap.data();
  const deal = room?.deal || null;
  if (!deal) return;

  const min = deal.min || 1;
  const max = deal.max || 100;

  if (room.status === "clue") {
    if (!Array.isArray(deal.players)) return;
    const idx = (deal.players as string[]).indexOf(uid);
    if (idx < 0) return;
    // プレイヤー数とseedのみに依存する決定的な番号
    const { generateDeterministicNumbers } = await import("@/lib/game/random");
    const nums = generateDeterministicNumbers(
      deal.players.length,
      min,
      max,
      deal.seed
    );
    const myNum = nums[idx];
    if (me.number !== myNum) {
      await updateDoc(doc(db!, "rooms", roomId, "players", uid), {
        number: myNum,
        clue1: me.clue1 || "",
        ready: false,
        orderIndex: 0,
      });
    }
  }
}

export async function updateLastActive(roomId: string) {
  await updateDoc(doc(db!, "rooms", roomId), {
    lastActiveAt: serverTimestamp(),
  });
}

export async function joinRoomFully({
  roomId,
  uid,
  displayName,
}: {
  roomId: string;
  uid: string;
  displayName: string | null | undefined;
}) {
  const created = await ensureMember({ roomId, uid, displayName });
  if (created.joined) {
    await addLateJoinerToDeal(roomId, uid).catch(() => void 0);
    await assignNumberIfNeeded(roomId, uid).catch(() => void 0);
    await updateLastActive(roomId).catch(() => void 0);
    try {
      const { addDoc, collection, serverTimestamp } = await import(
        "firebase/firestore"
      );
      await addDoc(collection(db!, "rooms", roomId, "chat"), {
        sender: "system",
        text: `${displayName || "匿名"} が参加しました`,
        createdAt: serverTimestamp(),
      } as any);
    } catch {}
  }
  await cleanupDuplicatePlayerDocs(roomId, uid).catch(() => void 0);
}
