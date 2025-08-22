import { db, firebaseEnabled } from "@/lib/firebase/client"
import type { Firestore } from "firebase/firestore"

export function requireDb(): Firestore {
  if (!firebaseEnabled || !db) throw new Error("Firebase is not configured")
  return db
}

