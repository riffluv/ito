// Simple cross-tab broadcast helper with graceful fallback
// - Uses BroadcastChannel when available
// - Falls back to window.storage event via localStorage

type RoundEvent =
  | { type: 'ROUND_RESET'; roomId: string; at: number }
  | { type: 'ROUND_PREPARE'; roomId: string; at: number };

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
    try { ch.postMessage(evt); } catch {}
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

// Fire when the host starts the next round preparation (auto-start lock target)
export function postRoundPrepare(roomId: string) {
  const evt: RoundEvent = { type: 'ROUND_PREPARE', roomId, at: Date.now() };
  const ch = getChannel();
  if (ch) {
    try { ch.postMessage(evt); } catch {}
    try { ch.close(); } catch {}
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`ito:round:${roomId}:prepare`, String(evt.at));
      const until = Date.now() + 5000;
      localStorage.setItem(`ito:round:${roomId}:prepareUntil`, String(until));
      setTimeout(() => {
        try { localStorage.removeItem(`ito:round:${roomId}:prepare`); } catch {}
        // keep prepareUntil; it expires naturally by time check
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
    const onMsg = (event: MessageEvent<RoundEvent>) => {
      const data = event.data;
      if (data?.type === 'ROUND_RESET' && data.roomId === roomId) {
        onReset(data.at);
      }
    };
    ch.addEventListener('message', onMsg);
    subs.push(() => {
      try { ch.removeEventListener('message', onMsg); } catch {}
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

export function subscribeRoundPrepare(
  roomId: string,
  onPrepare: (at: number) => void
): () => void {
  const subs: Array<() => void> = [];
  const ch = getChannel();
  if (ch) {
    const onMsg = (event: MessageEvent<RoundEvent>) => {
      const data = event.data;
      if (data?.type === 'ROUND_PREPARE' && data.roomId === roomId) {
        onPrepare(data.at);
      }
    };
    ch.addEventListener('message', onMsg);
    subs.push(() => {
      try { ch.removeEventListener('message', onMsg); } catch {}
      try { ch.close(); } catch {}
    });
  }
  const onStorage = (e: StorageEvent) => {
    try {
      if (!e.key) return;
      const key = `ito:round:${roomId}:prepare`;
      if (e.key === key && e.newValue) {
        const ts = parseInt(e.newValue, 10);
        if (!Number.isNaN(ts)) onPrepare(ts);
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
