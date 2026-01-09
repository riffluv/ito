// Simple cross-tab broadcast helper with graceful fallback
// - Uses BroadcastChannel when available
// - Falls back to window.storage event via localStorage

type RoundEvent =
  | { type: "ROUND_RESET"; roomId: string; at: number }
  | { type: "ROUND_PREPARE"; roomId: string; at: number };

const CHANNEL_NAME = "ito-round-events";

const resetKey = (roomId: string) => `ito:round:${roomId}:reset`;
const prepareKey = (roomId: string) => `ito:round:${roomId}:prepare`;
const prepareUntilKey = (roomId: string) => `ito:round:${roomId}:prepareUntil`;

function getChannel(): BroadcastChannel | null {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      return new BroadcastChannel(CHANNEL_NAME);
    }
  } catch {
    // ignore
  }
  return null;
}

function postToChannel(evt: RoundEvent) {
  const ch = getChannel();
  if (!ch) return;
  try {
    ch.postMessage(evt);
  } catch {
    // ignore
  }
  try {
    ch.close();
  } catch {
    // ignore
  }
}

function setLocalStorage(key: string, value: string) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

function removeLocalStorageLater(key: string, delayMs: number) {
  setTimeout(() => {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  }, delayMs);
}

export function postRoundReset(roomId: string) {
  const evt: RoundEvent = { type: "ROUND_RESET", roomId, at: Date.now() };
  postToChannel(evt);
  setLocalStorage(resetKey(roomId), String(evt.at));
  // remove soon to avoid clutter
  removeLocalStorageLater(resetKey(roomId), 1000);
}

// Fire when the host starts the next round preparation (auto-start lock target)
export function postRoundPrepare(roomId: string) {
  const evt: RoundEvent = { type: "ROUND_PREPARE", roomId, at: Date.now() };
  postToChannel(evt);
  setLocalStorage(prepareKey(roomId), String(evt.at));
  setLocalStorage(prepareUntilKey(roomId), String(Date.now() + 5000));
  removeLocalStorageLater(prepareKey(roomId), 1000);
  // keep prepareUntil; it expires naturally by time check
}

function subscribeChannel(
  roomId: string,
  type: RoundEvent["type"],
  onEvent: (at: number) => void
): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const onMsg = (event: MessageEvent<RoundEvent>) => {
    const data = event.data;
    if (data?.type === type && data.roomId === roomId) {
      onEvent(data.at);
    }
  };
  ch.addEventListener("message", onMsg);
  return () => {
    try {
      ch.removeEventListener("message", onMsg);
    } catch {
      // ignore
    }
    try {
      ch.close();
    } catch {
      // ignore
    }
  };
}

function subscribeStorage(
  key: string,
  onEvent: (at: number) => void
): () => void {
  const onStorage = (e: StorageEvent) => {
    try {
      if (e.key !== key) return;
      if (!e.newValue) return;
      const ts = parseInt(e.newValue, 10);
      if (!Number.isNaN(ts)) onEvent(ts);
    } catch {
      // ignore
    }
  };
  try {
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
  } catch {
    // ignore
  }
  return () => {};
}

export function subscribeRoundEvents(
  roomId: string,
  onReset: (at: number) => void
): () => void {
  const subs: Array<() => void> = [];
  subs.push(subscribeChannel(roomId, "ROUND_RESET", onReset));
  subs.push(subscribeStorage(resetKey(roomId), onReset));
  return () => subs.forEach((fn) => fn());
}

export function subscribeRoundPrepare(
  roomId: string,
  onPrepare: (at: number) => void
): () => void {
  const subs: Array<() => void> = [];
  subs.push(subscribeChannel(roomId, "ROUND_PREPARE", onPrepare));
  subs.push(subscribeStorage(prepareKey(roomId), onPrepare));
  return () => subs.forEach((fn) => fn());
}
