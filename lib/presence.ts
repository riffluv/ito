export {
  attachPresence,
  isPresenceConnectionActive,
  presenceSupported,
  subscribePresence,
  type PresenceConn,
  type PresenceRoomMap,
  type PresenceUserMap,
} from "@/lib/firebase/presence";

export {
  MAX_CLOCK_SKEW_MS,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_HEARTBEAT_RETRY_DELAYS_MS,
  PRESENCE_STALE_MS,
} from "@/lib/constants/presence";
