import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { PlayerDoc, RoomOptions } from "@/lib/types";

export async function setRoomOptions(roomId: string, options: RoomOptions) {
  await updateDoc(doc(db, "rooms", roomId), { options });
}

export async function updateLastActive(roomId: string) {
  await updateDoc(doc(db, "rooms", roomId), { lastActiveAt: serverTimestamp() });
}

export async function transferHost(roomId: string, newHostId: string) {
  await updateDoc(doc(db, "rooms", roomId), { hostId: newHostId });
}

export async function leaveRoom(roomId: string, userId: string, displayName: string | null | undefined) {
  // 参加者一覧からホスト移譲先を決定
  const playersSnap = await getDocs(collection(db, "rooms", roomId, "players"));
  const all = playersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as (PlayerDoc & { id: string })[];
  const others = all.filter(p => p.id !== userId);

  if (others.length > 0) {
    // 既存ホストが退出する場合は移譲（ここでは常に最初の人へ）
    // 呼び出し側でホストかどうか判断済みでも良いが、冪等性を考慮し単純移譲
    await transferHost(roomId, others[0].id);
  }

  // 自分を退室（重複Docも含めて完全削除）
  try {
    const dupQ = query(collection(db, "rooms", roomId, "players"), where("uid", "==", userId));
    const dupSnap = await getDocs(dupQ);
    await Promise.all(dupSnap.docs.map(d => deleteDoc(doc(db, "rooms", roomId, "players", d.id))));
  } catch {
    // フォールバック: 主Docだけ削除
    await deleteDoc(doc(db, "rooms", roomId, "players", userId));
  }
  // ルームの最終アクティブ
  await updateLastActive(roomId);
  // チャットへ退出ログ
  await addDoc(collection(db, "rooms", roomId, "chat"), {
    sender: "system",
    text: `${displayName || "匿名"} が退出しました`,
    createdAt: serverTimestamp(),
  });
}
