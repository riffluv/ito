import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export async function sendMessage(roomId: string, uid: string, sender: string, text: string) {
  await addDoc(collection(db!, "rooms", roomId, "chat"), {
    sender,
    uid,
    text,
    createdAt: serverTimestamp(),
  });
}
