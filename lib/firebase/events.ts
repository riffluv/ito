import { db } from "@/lib/firebase/client";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export type NotifyEvent = {
  kind: "notify";
  type: "info" | "warning" | "success" | "error";
  title: string;
  description?: string;
  createdAt?: any;
};

export async function sendNotifyEvent(
  roomId: string,
  opts: { type: NotifyEvent["type"]; title: string; description?: string }
) {
  await addDoc(collection(db!, "rooms", roomId, "events"), {
    kind: "notify",
    type: opts.type,
    title: opts.title,
    description: opts.description ?? undefined,
    createdAt: serverTimestamp(),
  } as NotifyEvent);
}

