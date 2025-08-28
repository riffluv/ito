import { db } from "@/lib/firebase/client";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export async function sendMessage(
  roomId: string,
  uid: string,
  sender: string,
  text: string
) {
  await addDoc(collection(db!, "rooms", roomId, "chat"), {
    sender,
    uid,
    text,
    createdAt: serverTimestamp(),
  });
}

export async function sendSystemMessage(roomId: string, text: string) {
  await addDoc(collection(db!, "rooms", roomId, "chat"), {
    sender: "system",
    uid: "system",
    text,
    createdAt: serverTimestamp(),
  });
}
