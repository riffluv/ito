import { doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { sanitizePlainText } from "@/lib/utils/sanitize";

export async function updateClue1(roomId: string, playerId: string, value: string) {
  const clean = sanitizePlainText(value).slice(0, 120);
  const hasClue = clean.trim().length > 0;
  await updateDoc(doc(db!, "rooms", roomId, "players", playerId), {
    clue1: clean,
    ready: hasClue,
  });
}

export async function saveOrderIndices(roomId: string, order: string[]) {
  const batch = writeBatch(db!);
  order.forEach((pid, idx) => {
    batch.update(doc(db!, "rooms", roomId, "players", pid), { orderIndex: idx });
  });
  await batch.commit();
}

export async function setReady(roomId: string, playerId: string, ready: boolean) {
  await updateDoc(doc(db!, "rooms", roomId, "players", playerId), { ready });
}

export async function updateLastSeen(roomId: string, playerId: string) {
  await updateDoc(doc(db!, "rooms", roomId, "players", playerId), { lastSeen: serverTimestamp() });
}

export async function resetPlayerState(roomId: string, playerId: string) {
  await updateDoc(doc(db!, "rooms", roomId, "players", playerId), {
    number: null,
    clue1: "",
    ready: false,
    orderIndex: 0,
  });
}

export async function setPlayerNameAvatar(roomId: string, playerId: string, name: string, avatar: string) {
  const cleanName = sanitizePlainText(name).slice(0, 24);
  await updateDoc(doc(db!, "rooms", roomId, "players", playerId), { name: cleanName, avatar });
}

export async function setPlayerName(roomId: string, playerId: string, name: string) {
  const cleanName = sanitizePlainText(name).slice(0, 24);
  await updateDoc(doc(db!, "rooms", roomId, "players", playerId), { name: cleanName });
}
