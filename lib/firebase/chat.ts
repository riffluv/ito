import { db } from "@/lib/firebase/client";
import { sanitizePlainText } from "@/lib/utils/sanitize";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export async function sendMessage(
  roomId: string,
  uid: string,
  sender: string,
  text: string
) {
  const cleanText = sanitizePlainText(text).slice(0, 500);
  const cleanSender = sanitizePlainText(sender).slice(0, 32) || "匿名";
  await addDoc(collection(db!, "rooms", roomId, "chat"), {
    sender: cleanSender,
    uid,
    text: cleanText,
    createdAt: serverTimestamp(),
  });
}

export async function sendSystemMessage(roomId: string, text: string) {
  const cleanText = sanitizePlainText(text).slice(0, 500);
  await addDoc(collection(db!, "rooms", roomId, "chat"), {
    sender: "system",
    uid: "system",
    text: cleanText,
    createdAt: serverTimestamp(),
  });
}
