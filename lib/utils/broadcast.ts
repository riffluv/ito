// Simple cross-tab broadcast helper with graceful fallback
// - Uses BroadcastChannel when available
// - Falls back to window.storage event via localStorage

type RoundEvent = { type: 'ROUND_RESET'; roomId: string; at: number };

const CHANNEL_NAME = 'ito-round-events';

function getChannel(): BroadcastChannel | null {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      return new BroadcastChannel(CHANNEL_NAME);
    }
  } catch {}
  return null;
}

export function postRoundReset(roomId: string) {
  const evt: RoundEvent = { type: 'ROUND_RESET', roomId, at: Date.now() };
  // BroadcastChannel
  const ch = getChannel();
  if (ch) {
    try { ch.postMessage(evt as any); } catch {}
    try { ch.close(); } catch {}
  }
  // storage fallback
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`ito:round:${roomId}:reset`, String(evt.at));
      // remove soon to avoid clutter
      setTimeout(() => {
        try { localStorage.removeItem(`ito:round:${roomId}:reset`); } catch {}
      }, 1000);
    }
  } catch {}
}

export function subscribeRoundEvents(
  roomId: string,
  onReset: (at: number) => void
): () => void {
  const subs: Array<() => void> = [];
  // BroadcastChannel
  const ch = getChannel();
  if (ch) {
    const onMsg = (e: MessageEvent) => {
      const data = e.data as RoundEvent;
      if (data && data.type === 'ROUND_RESET' && data.roomId === roomId) {
        onReset(data.at);
      }
    };
    ch.addEventListener('message', onMsg as any);
    subs.push(() => {
      try { ch.removeEventListener('message', onMsg as any); } catch {}
      try { ch.close(); } catch {}
    });
  }
  // storage fallback
  const onStorage = (e: StorageEvent) => {
    try {
      if (!e.key) return;
      const key = `ito:round:${roomId}:reset`;
      if (e.key === key && e.newValue) {
        const ts = parseInt(e.newValue, 10);
        if (!Number.isNaN(ts)) onReset(ts);
      }
    } catch {}
  };
  try {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
      subs.push(() => window.removeEventListener('storage', onStorage));
    }
  } catch {}

  return () => subs.forEach((fn) => fn());
}

