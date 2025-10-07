import { db } from "@/lib/firebase/client";
import { enqueueFirestoreWrite } from "@/lib/firebase/writeQueue";
import { doc, updateDoc, deleteField } from "firebase/firestore";

function inMemoryKey(roomId: string, voterId: string) {
  return "mvpVote:" + roomId + ":" + voterId;
}

export async function castMvpVote(
  roomId: string,
  voterId: string,
  targetId: string | null
) {
  if (!db) return;
  if (!roomId || !voterId) return;

  await enqueueFirestoreWrite(inMemoryKey(roomId, voterId), async () => {
    const ref = doc(db!, "rooms", roomId);
    const fieldPath = "mvpVotes." + voterId;
    if (!targetId) {
      await updateDoc(ref, {
        [fieldPath]: deleteField(),
      });
      return;
    }
    await updateDoc(ref, {
      [fieldPath]: targetId,
    });
  });
}
