import { getAdminAuth, getAdminDb } from "@/lib/server/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export type HostSession = {
  uid: string;
  roomId: string;
  issuedAt: number;
  expiresAt: number;
  sessionId: string;
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const COLLECTION = "hostSessions";

export async function issueHostSession(roomId: string, idToken: string): Promise<HostSession> {
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);
  const uid = decoded.uid;
  const now = Date.now();
  const session: HostSession = {
    uid,
    roomId,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
    sessionId: `${roomId}-${uid}-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const db = getAdminDb();
  await db.collection(COLLECTION).doc(session.sessionId).set({
    ...session,
    createdAt: FieldValue.serverTimestamp(),
  });
  return session;
}

export async function verifyHostSession(sessionId: string, roomId: string): Promise<{ uid: string } | null> {
  if (!sessionId) return null;
  const db = getAdminDb();
  const snap = await db.collection(COLLECTION).doc(sessionId).get();
  if (!snap.exists) return null;
  const data = snap.data() as HostSession | undefined;
  if (!data) return null;
  const now = Date.now();
  if (data.roomId !== roomId) return null;
  if (data.expiresAt < now) return null;
  return { uid: data.uid };
}
