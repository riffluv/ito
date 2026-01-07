import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "@/lib/server/firebaseAdmin";

function sanitizeServerText(input: unknown, maxLength = 500): string {
  if (typeof input !== "string") return "";
  // eslint-disable-next-line no-control-regex -- 制御文字を明示的に除去するためのパターン
  const controlCharsPattern = /[\u0000-\u001F\u007F]/g;
  const normalized = input
    .replace(controlCharsPattern, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.slice(0, Math.max(maxLength, 0));
}

export async function sendSystemMessage(roomId: string, text: string) {
  const clean = sanitizeServerText(text);
  if (!clean) return;
  const db = getAdminDb();
  await db
    .collection("rooms")
    .doc(roomId)
    .collection("chat")
    .add({
      sender: "system",
      uid: "system",
      text: clean,
      createdAt: FieldValue.serverTimestamp(),
    })
    .catch(() => void 0);
}

