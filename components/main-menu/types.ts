import type { RoomDoc } from "@/lib/types";
import type { FieldValue, Timestamp } from "firebase/firestore";

export type LobbyRoom = (RoomDoc & { id: string }) & {
  expiresAt?: Timestamp | Date | number | FieldValue | null;
  lastActiveAt?: Timestamp | Date | number | FieldValue | null;
  createdAt?: Timestamp | Date | number | FieldValue | null;
  deal?: RoomDoc["deal"];
};

