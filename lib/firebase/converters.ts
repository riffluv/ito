import type { FirestoreDataConverter } from "firebase/firestore"
import type { RoomDoc, PlayerDoc } from "@/lib/types"
import { sanitizeRoom, sanitizePlayer } from "@/lib/state/sanitize"

// Firestore <-> TypeScript 型の橋渡し。取得時に最小限のサニタイズも行う。
export const roomConverter: FirestoreDataConverter<RoomDoc & { id: string }> = {
  toFirestore(value) {
    const { id: _omit, ...rest } = value as any
    return rest
  },
  fromFirestore(snapshot, _options) {
    const data = snapshot.data()
    return { id: snapshot.id, ...sanitizeRoom(data) }
  },
}

export const playerConverter: FirestoreDataConverter<PlayerDoc & { id: string }> = {
  toFirestore(value) {
    const { id: _omit, ...rest } = value as any
    return rest
  },
  fromFirestore(snapshot, _options) {
    const data = snapshot.data()
    return sanitizePlayer(snapshot.id, data)
  },
}

