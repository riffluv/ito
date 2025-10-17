"use client";
import { db, firebaseEnabled, rtdb } from "@/lib/firebase/client";
import { presenceSupported } from "@/lib/firebase/presence";
import {
  MAX_CLOCK_SKEW_MS,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_STALE_MS,
} from "@/lib/constants/presence";
import { ACTIVE_WINDOW_MS } from "@/lib/time";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import { logDebug, logInfo, logWarn } from "@/lib/utils/log";
import { off, onValue, ref } from "firebase/database";
import {
  Timestamp,
  collection,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

type VerificationCacheEntry = {
  count: number;
  expiresAt: number;
};

type VerificationHealth = {
  backoffMs: number;
  failures: number;
  lastVerifiedAt: number;
  healthScore: number;
};

const MIN_BACKOFF_MS = 10_000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;
const CACHE_TTL_MS = 30_000;
const HEALTH_DECAY_MS = 5 * 60 * 1000;
const HEALTH_RECOVERY_STEP = 0.25;
const HEALTH_PENALTY_STEP = 0.5;
const DEFAULT_HEALTH = 1;

function nowMs() {
  return Date.now();
}

function getVerificationHealth(
  store: Map<string, VerificationHealth>,
  roomId: string
) {
  let entry = store.get(roomId);
  if (!entry) {
    entry = {
      backoffMs: MIN_BACKOFF_MS,
      failures: 0,
      lastVerifiedAt: 0,
      healthScore: DEFAULT_HEALTH,
    };
    store.set(roomId, entry);
    return entry;
  }
  if (entry.lastVerifiedAt > 0) {
    const elapsed = nowMs() - entry.lastVerifiedAt;
    if (elapsed > HEALTH_DECAY_MS && entry.healthScore < DEFAULT_HEALTH) {
      entry.healthScore = Math.min(
        DEFAULT_HEALTH,
        entry.healthScore + HEALTH_RECOVERY_STEP
      );
      entry.failures = Math.max(0, entry.failures - 1);
      entry.backoffMs = Math.max(MIN_BACKOFF_MS, entry.backoffMs / 2);
      entry.lastVerifiedAt = nowMs();
    }
  }
  return entry;
}

function updateHealthOnSuccess(entry: VerificationHealth) {
  entry.healthScore = Math.min(DEFAULT_HEALTH, entry.healthScore + 0.25);
  entry.failures = 0;
  entry.backoffMs = Math.max(MIN_BACKOFF_MS, entry.backoffMs / 2);
  entry.lastVerifiedAt = nowMs();
}

function updateHealthOnFailure(entry: VerificationHealth) {
  entry.failures += 1;
  entry.healthScore = Math.max(0, entry.healthScore - HEALTH_PENALTY_STEP);
  entry.backoffMs = Math.min(
    MAX_BACKOFF_MS,
    Math.max(MIN_BACKOFF_MS, entry.backoffMs * 2)
  );
  entry.lastVerifiedAt = nowMs();
}

function shouldSkipVerification(
  entry: VerificationHealth,
  lastCheckAt: number,
  now: number
) {
  if (now - lastCheckAt < entry.backoffMs) {
    return true;
  }
  if (entry.healthScore === 0) {
    return true;
  }
  return false;
}

function recordLobbyMetric(name: string, durationMs: number, roomId: string) {
  if (typeof window === "undefined") return;
  const w = window as typeof window & {
    __ITO_METRICS__?: Array<{
      name: string;
      duration: number;
      roomId: string;
      ts: number;
    }>;
  };
  if (!Array.isArray(w.__ITO_METRICS__)) {
    w.__ITO_METRICS__ = [];
  }
  w.__ITO_METRICS__!.push({
    name,
    duration: durationMs,
    roomId,
    ts: Date.now(),
  });
  if (w.__ITO_METRICS__!.length > 200) {
    w.__ITO_METRICS__!.splice(0, w.__ITO_METRICS__!.length - 200);
  }
}

export type UseLobbyCountsOptions = {
  // 自分自身や特定UIDをカウントから除外（ロビー表示で「他人数」を出したい場合や、
  // 退出直後の自身ゴースト対策として有効）
  excludeUid?: string | string[];
};

type FreezeTrackerSource = "presence" | "fallback";
type FreezeTracker = {
  start: (
    roomId: string,
    now: number,
    freezeUntil: number,
    freezeMs: number
  ) => void;
  end: (roomId: string, now: number) => void;
};

function applyCountUpdates(
  setCounts: Dispatch<SetStateAction<Record<string, number>>>,
  updates: Record<string, number>
) {
  const entries = Object.entries(updates);
  if (entries.length === 0) return;
  setCounts((prev) => {
    let changed = false;
    const next: Record<string, number> = { ...prev };
    for (const [id, value] of entries) {
      if (next[id] !== value) {
        next[id] = value;
        changed = true;
      }
    }
    return changed ? next : prev;
  });
}

function createFreezeTracker(source: FreezeTrackerSource): FreezeTracker {
  const startedAt: Record<string, number> = {};
  return {
    start(roomId, now, _freezeUntil, freezeMs) {
      if (startedAt[roomId]) return;
      startedAt[roomId] = now;
      logInfo("useLobbyCounts", "zero-freeze-start", {
        roomId,
        source,
        freezeMs,
      });
    },
    end(roomId, now) {
      const started = startedAt[roomId];
      if (started === undefined) return;
      const durationMs = Math.max(now - started, 0);
      delete startedAt[roomId];
      logInfo("useLobbyCounts", "zero-freeze-end", {
        roomId,
        source,
        durationMs,
      });
    },
  };
}

export function useLobbyCounts(
  roomIds: string[],
  enabled: boolean,
  options?: UseLobbyCountsOptions
) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const verificationStateRef = useRef({
    cache: new Map<string, VerificationCacheEntry>(),
    health: new Map<string, VerificationHealth>(),
  });
  const verificationLastCheckRef = useRef({
    single: {} as Record<string, number>,
    multi: {} as Record<string, number>,
  });

  const normalizedExcludeUids = useMemo(() => {
    if (!options?.excludeUid) return [];
    const source = Array.isArray(options.excludeUid)
      ? options.excludeUid
      : [options.excludeUid];
    return Array.from(
      new Set(
        source.filter((uid): uid is string =>
          typeof uid === "string" && uid.length > 0
        )
      )
    );
  }, [options?.excludeUid]);
  const excludeKey = normalizedExcludeUids.join(",");
  // 緊急時に Firestore フォールバックを完全停止するフラグ（.env から）
  const DISABLE_FS_FALLBACK =
    typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_DISABLE_FS_FALLBACK?.toString() === "1" ||
      process.env.NEXT_PUBLIC_DISABLE_FS_FALLBACK?.toLowerCase() === "true");
  const DEBUG_FALLBACK =
    typeof process !== "undefined" &&
    ((process.env.NEXT_PUBLIC_LOBBY_DEBUG_FALLBACK || "")
      .toString()
      .toLowerCase() === "true" ||
      (process.env.NEXT_PUBLIC_LOBBY_DEBUG_FALLBACK || "").toString().trim() ===
        "1");

  // roomIds キー以外の値をクリーンに保つ
  const roomKey = useMemo(
    () => Array.from(new Set(roomIds)).sort().join(","),
    [roomIds]
  );
  useEffect(() => {
    setCounts((prev) => {
      const next: Record<string, number> = {};
      for (const id of roomIds) next[id] = prev[id] ?? 0;
      return next;
    });
  }, [roomKey]);

  useEffect(() => {
    if (!firebaseEnabled || !enabled) {
      setCounts({});
      return;
    }
    if (roomIds.length === 0) {
      setCounts({});
      return;
    }

    // RTDB presence を部屋ごとに購読（ルール互換性のため /presence/$roomId を読む）
    if (presenceSupported()) {
      const freezeTracker = createFreezeTracker("presence");
      const DEBUG_UIDS =
        typeof process !== "undefined" &&
        ((process.env.NEXT_PUBLIC_LOBBY_DEBUG_UIDS || "").toString() === "1" ||
          (process.env.NEXT_PUBLIC_LOBBY_DEBUG_UIDS || "")
            .toString()
            .toLowerCase() === "true");
      // 既定値は OFF（読み取り節約）。必要時のみ .env で有効化
      const VERIFY_SINGLE = (() => {
        if (typeof process === "undefined") return false;
        const raw = (process.env.NEXT_PUBLIC_LOBBY_VERIFY_SINGLE || "")
          .toString()
          .toLowerCase();
        if (!raw) return false; // default OFF
        return raw === "1" || raw === "true";
      })();
      const VERIFY_MULTI = (() => {
        if (typeof process === "undefined") return false;
        const raw = (process.env.NEXT_PUBLIC_LOBBY_VERIFY_MULTI || "")
          .toString()
          .toLowerCase();
        if (!raw) return false; // default OFF
        return raw === "1" || raw === "true";
      })();
      const excludeSet = new Set(normalizedExcludeUids);
      // ロビー表示はゴースト抑制のため、presenceの鮮度しきい値をさらに短めに（既定8s）
      const ENV_STALE = Number(
        (process.env.NEXT_PUBLIC_LOBBY_STALE_MS || "").toString()
      );
      // 心拍より短い鮮度窓はフラッピングを招くため、最低でも heartbeat+5s を確保
      const MIN_STALE = PRESENCE_HEARTBEAT_MS + 5_000;
      const LOBBY_STALE_MS = Math.min(
        PRESENCE_STALE_MS,
        Math.max(
          MIN_STALE,
          Number.isFinite(ENV_STALE) && ENV_STALE > 0 ? ENV_STALE : 35_000
        )
      );
      // 0人からの反跳ね（古いconnが遅れて現れる）を防ぐためのクールダウン
      const zeroFreeze: Record<string, number> = {};
      // 据え置きの既定値（必要なら環境変数で短縮/延長）
      const ENV_ZERO_FREEZE = Number(
        (process.env.NEXT_PUBLIC_LOBBY_ZERO_FREEZE_MS || "").toString()
      );
      const ZERO_FREEZE_MS_DEFAULT =
        Number.isFinite(ENV_ZERO_FREEZE) && ENV_ZERO_FREEZE > 0
          ? ENV_ZERO_FREEZE
          : Math.max(20_000, LOBBY_STALE_MS + 5_000); // stale超え+αで安全側に
      // 新規参加を即時に検出するための“新鮮さ”しきい値（5秒以内のtsがあればフリーズ解除）
      const ACCEPT_FRESH_MS = 5_000;
      // 一度だけデバッグ情報を表示（presentモードの有効値）
      if (typeof window !== "undefined") {
        logInfo("useLobbyCounts", "presence-config", {
          staleMs: LOBBY_STALE_MS,
          zeroFreezeMs: ZERO_FREEZE_MS_DEFAULT,
          acceptFreshMs: ACCEPT_FRESH_MS,
          excludeCount: excludeSet.size,
        });
      }
      // n===1 のときだけ行う軽量検証のスロットル管理
      const singleCheckInflight: Record<string, boolean> = {};
      const singleCheckCooldown: Record<string, number> = {};
      const multiCheckInflight: Record<string, boolean> = {};
      const multiCheckCooldown: Record<string, number> = {};
      {
        const { cache, health } = verificationStateRef.current;
        const active = new Set(roomIds);
        for (const key of Array.from(cache.keys())) {
          if (!active.has(key)) cache.delete(key);
        }
        for (const key of Array.from(health.keys())) {
          if (!active.has(key)) health.delete(key);
        }
        for (const map of [
          verificationLastCheckRef.current.single,
          verificationLastCheckRef.current.multi,
          singleCheckCooldown,
          multiCheckCooldown,
        ]) {
          for (const key of Object.keys(map)) {
            if (!active.has(key)) delete map[key];
          }
        }
      }
      // players=0 と検証された単独UIDを一時的に無視するクオランティン
      const quarantine: Record<string, Record<string, number>> = {};

      const offs = roomIds.map((id) => {
        const roomRef = ref(rtdb!, `presence/${id}`);
        const handler = (snap: any) => {
          const queuedUpdates: Record<string, number> = {};
          const queueCountUpdate = (value: number) => {
            queuedUpdates[id] = value;
          };
          const users = (snap.val() || {}) as Record<
            string,
            Record<string, any>
          >; // uid -> connId -> { ts }
          let n = 0;
          const now = Date.now();
          let hasFresh = false; // 直近JOIN（5s以内）の兆候
          const includedUids: string[] | undefined = DEBUG_UIDS
            ? []
            : undefined;
          const presentUids: string[] | undefined = DEBUG_UIDS
            ? Object.keys(users)
            : undefined;
          for (const uid of Object.keys(users)) {
            if (excludeSet.has(uid)) continue; // 自身など除外対象はスキップ
            const conns = users[uid] || {};
            // より厳格な判定：最新の有効なタイムスタンプのみ
            let latestValidTs = 0;
            for (const c of Object.values(conns) as any[]) {
              if (c?.online === false) continue;
              if (c?.online === true && typeof c?.ts !== "number") {
                latestValidTs = Math.max(latestValidTs, now);
                hasFresh = true;
                continue;
              }
              const ts = typeof c?.ts === "number" ? c.ts : 0;
              if (ts <= 0) continue; // 無効なタイムスタンプ
              if (ts - now > MAX_CLOCK_SKEW_MS) continue; // 未来すぎる
              if (now - ts > LOBBY_STALE_MS) continue; // 古すぎる（ロビーは短め）
              latestValidTs = Math.max(latestValidTs, ts);
              if (!hasFresh && now - ts <= ACCEPT_FRESH_MS) hasFresh = true;
            }
            // クオランティン対象（ただし新鮮なJOINは即解除）
            const qUntil = quarantine[id]?.[uid] || 0;
            if (qUntil && latestValidTs > 0) {
              const isFresh = now - latestValidTs <= ACCEPT_FRESH_MS;
              if (isFresh) {
                // 即解除して通常カウント
                if (quarantine[id]) delete quarantine[id][uid];
              } else {
                // 無視
                continue;
              }
            }
            const isOnline = latestValidTs > 0;
            if (isOnline) {
              n += 1;
              if (DEBUG_UIDS && includedUids) includedUids.push(uid);
            }
          }
          if (DEBUG_UIDS) {
            try {
              logDebug("useLobbyCounts", "presence-room", {
                roomId: id,
                present: presentUids?.join(",") || "-",
                excluded: excludeSet.size,
                included: includedUids?.join(",") || "-",
                count: n,
              });
            } catch {}
          }
          // 特殊対策: n===1 の場合だけ、players コレクションのサーバカウントで検証（任意有効化）。
          // もし players=0 なら、presence の一時的な残骸とみなし 0 に矯正しゼロフリーズ開始。
          if (VERIFY_SINGLE && n === 1 && !DISABLE_FS_FALLBACK) {
            const { cache, health: healthStore } = verificationStateRef.current;
            const healthEntry = getVerificationHealth(healthStore, id);
            const cached = cache.get(id);
            if (cached && cached.expiresAt > now) {
              if (cached.count === 0) {
                const freezeUntil = now + ZERO_FREEZE_MS_DEFAULT;
                zeroFreeze[id] = freezeUntil;
                freezeTracker.start(
                  id,
                  now,
                  freezeUntil,
                  ZERO_FREEZE_MS_DEFAULT
                );
                queueCountUpdate(0);
              }
              updateHealthOnSuccess(healthEntry);
              verificationLastCheckRef.current.single[id] = now;
              singleCheckCooldown[id] = now + healthEntry.backoffMs;
              if (DEBUG_FALLBACK) {
                try {
                  logDebug("useLobbyCounts", "verify-single-cache", {
                    roomId: id,
                    count: cached.count,
                    nextMs: healthEntry.backoffMs,
                  });
                } catch {}
              }
            } else {
              const lastCheck =
                verificationLastCheckRef.current.single[id] || 0;
              const nextAllowed = singleCheckCooldown[id] || 0;
              if (
                shouldSkipVerification(healthEntry, lastCheck, now) ||
                now < nextAllowed
              ) {
                if (DEBUG_FALLBACK) {
                  try {
                    logDebug("useLobbyCounts", "verify-single-skip", {
                      roomId: id,
                      reason:
                        now < nextAllowed
                          ? "cooldown"
                          : healthEntry.healthScore === 0
                            ? "health-zero"
                            : "backoff",
                      nextAllowed,
                    });
                  } catch {}
                }
                singleCheckCooldown[id] = Math.max(
                  nextAllowed,
                  now + healthEntry.backoffMs
                );
              } else if (!singleCheckInflight[id]) {
                singleCheckInflight[id] = true;
                const perf =
                  typeof window !== "undefined" &&
                  typeof window.performance !== "undefined"
                    ? window.performance
                    : null;
                perf?.mark(`lobby_fallback_single_start:${id}`);
                (async () => {
                  try {
                    const coll = collection(db!, "rooms", id, "players");
                    const since = Timestamp.fromMillis(
                      Date.now() - ACTIVE_WINDOW_MS
                    );
                    const q = query(coll, where("lastSeen", ">=", since));
                    const snap = await getCountFromServer(q);
                    const verified =
                      Number((snap.data() as any)?.count ?? 0) || 0;
                    const now2 = Date.now();
                    cache.set(id, {
                      count: verified,
                      expiresAt: now2 + CACHE_TTL_MS,
                    });
                    verificationLastCheckRef.current.single[id] = now2;
                    updateHealthOnSuccess(healthEntry);
                    singleCheckCooldown[id] = now2 + healthEntry.backoffMs;
                    if (verified === 0) {
                      const freezeUntil = now2 + ZERO_FREEZE_MS_DEFAULT;
                      zeroFreeze[id] = freezeUntil;
                      freezeTracker.start(
                        id,
                        now2,
                        freezeUntil,
                        ZERO_FREEZE_MS_DEFAULT
                      );
                      applyCountUpdates(setCounts, { [id]: 0 });
                      const suspect =
                        (includedUids && includedUids[0]) || undefined;
                      if (suspect) {
                        if (!quarantine[id]) quarantine[id] = {};
                        quarantine[id][suspect] = now2 + ZERO_FREEZE_MS_DEFAULT;
                      }
                      if (DEBUG_UIDS || DEBUG_FALLBACK) {
                        try {
                          logDebug("useLobbyCounts", "verify-single-zero", {
                            roomId: id,
                            freezeMs: ZERO_FREEZE_MS_DEFAULT,
                            suspect: suspect || "-",
                          });
                        } catch {}
                      }
                    } else if (verified > 0 && DEBUG_FALLBACK) {
                      try {
                        logDebug("useLobbyCounts", "verify-single-positive", {
                          roomId: id,
                          verified,
                        });
                      } catch {}
                    }
                  } catch (error) {
                    cache.delete(id);
                    verificationLastCheckRef.current.single[id] = Date.now();
                    updateHealthOnFailure(healthEntry);
                    singleCheckCooldown[id] =
                      verificationLastCheckRef.current.single[id] +
                      healthEntry.backoffMs;
                    if (isFirebaseQuotaExceeded(error)) {
                      handleFirebaseQuotaError("ロビー人数検証");
                    }
                    if (DEBUG_FALLBACK) {
                      try {
                        logWarn("useLobbyCounts", "verify-single-error", {
                          roomId: id,
                          error,
                        });
                      } catch {}
                    }
                  } finally {
                    singleCheckInflight[id] = false;
                    const endPerf =
                      typeof window !== "undefined" &&
                      typeof window.performance !== "undefined"
                        ? window.performance
                        : null;
                    try {
                      endPerf?.measure(
                        `lobby_fallback_single:${id}`,
                        `lobby_fallback_single_start:${id}`
                      );
                      const entry = endPerf
                        ?.getEntriesByName(`lobby_fallback_single:${id}`)
                        .pop();
                      if (entry) {
                        recordLobbyMetric(
                          "fallback_single",
                          entry.duration,
                          id
                        );
                      }
                    } catch {}
                    endPerf?.clearMarks(`lobby_fallback_single_start:${id}`);
                    endPerf?.clearMeasures?.(`lobby_fallback_single:${id}`);
                  }
                })();
              }
            }
          }
          // 任意対策: n>0 の場合でも必要に応じて検証（presenceゴースト抑止）。
          if (VERIFY_MULTI && n > 0 && !DISABLE_FS_FALLBACK) {
            const { cache, health: healthStore } = verificationStateRef.current;
            const healthEntry = getVerificationHealth(healthStore, id);
            const cached = cache.get(id);
            if (cached && cached.expiresAt > now) {
              if (cached.count === 0) {
                queueCountUpdate(0);
                const present = presentUids || [];
                if (present.length) {
                  if (!quarantine[id]) quarantine[id] = {};
                  for (const u of present) {
                    quarantine[id][u] = now + ZERO_FREEZE_MS_DEFAULT;
                  }
                }
              }
              updateHealthOnSuccess(healthEntry);
              verificationLastCheckRef.current.multi[id] = now;
              multiCheckCooldown[id] = now + healthEntry.backoffMs;
              if (DEBUG_FALLBACK) {
                try {
                  logDebug("useLobbyCounts", "verify-multi-cache", {
                    roomId: id,
                    count: cached.count,
                    nextMs: healthEntry.backoffMs,
                  });
                } catch {}
              }
            } else {
              const lastCheck = verificationLastCheckRef.current.multi[id] || 0;
              const nextAllowed = multiCheckCooldown[id] || 0;
              if (
                shouldSkipVerification(healthEntry, lastCheck, now) ||
                now < nextAllowed
              ) {
                if (DEBUG_FALLBACK) {
                  try {
                    logDebug("useLobbyCounts", "verify-multi-skip", {
                      roomId: id,
                      reason:
                        now < nextAllowed
                          ? "cooldown"
                          : healthEntry.healthScore === 0
                            ? "health-zero"
                            : "backoff",
                      nextAllowed,
                    });
                  } catch {}
                }
                multiCheckCooldown[id] = Math.max(
                  nextAllowed,
                  now + healthEntry.backoffMs
                );
              } else if (!multiCheckInflight[id]) {
                multiCheckInflight[id] = true;
                const perf =
                  typeof window !== "undefined" &&
                  typeof window.performance !== "undefined"
                    ? window.performance
                    : null;
                perf?.mark(`lobby_fallback_multi_start:${id}`);
                (async () => {
                  try {
                    const coll = collection(db!, "rooms", id, "players");
                    const since = Timestamp.fromMillis(
                      Date.now() - ACTIVE_WINDOW_MS
                    );
                    const q = query(coll, where("lastSeen", ">=", since));
                    const snap = await getCountFromServer(q);
                    const verified =
                      Number((snap.data() as any)?.count ?? 0) || 0;
                    const now2 = Date.now();
                    cache.set(id, {
                      count: verified,
                      expiresAt: now2 + CACHE_TTL_MS,
                    });
                    verificationLastCheckRef.current.multi[id] = now2;
                    updateHealthOnSuccess(healthEntry);
                    multiCheckCooldown[id] = now2 + healthEntry.backoffMs;
                    if (verified === 0) {
                      applyCountUpdates(setCounts, { [id]: 0 });
                      const present = presentUids || [];
                      if (present.length) {
                        if (!quarantine[id]) quarantine[id] = {};
                        for (const u of present) {
                          quarantine[id][u] = now2 + ZERO_FREEZE_MS_DEFAULT;
                        }
                      }
                    } else if (DEBUG_FALLBACK) {
                      try {
                        logDebug("useLobbyCounts", "verify-multi-positive", {
                          roomId: id,
                          verified,
                        });
                      } catch {}
                    }
                  } catch (error) {
                    cache.delete(id);
                    verificationLastCheckRef.current.multi[id] = Date.now();
                    updateHealthOnFailure(healthEntry);
                    multiCheckCooldown[id] =
                      verificationLastCheckRef.current.multi[id] +
                      healthEntry.backoffMs;
                    if (isFirebaseQuotaExceeded(error)) {
                      handleFirebaseQuotaError("ロビー人数検証");
                    }
                    if (DEBUG_FALLBACK) {
                      try {
                        logWarn("useLobbyCounts", "verify-multi-error", {
                          roomId: id,
                          error,
                        });
                      } catch {}
                    }
                  } finally {
                    multiCheckInflight[id] = false;
                    const endPerf =
                      typeof window !== "undefined" &&
                      typeof window.performance !== "undefined"
                        ? window.performance
                        : null;
                    try {
                      endPerf?.measure(
                        `lobby_fallback_multi:${id}`,
                        `lobby_fallback_multi_start:${id}`
                      );
                      const entry = endPerf
                        ?.getEntriesByName(`lobby_fallback_multi:${id}`)
                        .pop();
                      if (entry) {
                        recordLobbyMetric("fallback_multi", entry.duration, id);
                      }
                    } catch {}
                    endPerf?.clearMarks(`lobby_fallback_multi_start:${id}`);
                    endPerf?.clearMeasures?.(`lobby_fallback_multi:${id}`);
                  }
                })();
              }
            }
          }
          // 0→N 反跳ねの緩和：0になった直後は一定時間0に固定（ただし本当に復帰した場合のみ解除）
          const freezeUntil = zeroFreeze[id] || 0;
          if (n === 0) {
            zeroFreeze[id] = now + ZERO_FREEZE_MS_DEFAULT; // 0表示を据え置き
            freezeTracker.start(
              id,
              now,
              zeroFreeze[id],
              ZERO_FREEZE_MS_DEFAULT
            );
            queueCountUpdate(0);
          } else if (now < freezeUntil) {
            if (hasFresh && !VERIFY_MULTI) {
              zeroFreeze[id] = 0;
              freezeTracker.end(id, now);
              queueCountUpdate(n);
            } else if (VERIFY_MULTI) {
              // 新鮮なJOIN兆候があっても、検証で players>0 が確認できるまでは0固定（読み取りはCD内で抑制）
              const cd2 = multiCheckCooldown[id] || 0;
              if (!multiCheckInflight[id] && now >= cd2) {
                multiCheckInflight[id] = true;
                (async () => {
                  try {
                    const coll = collection(db!, "rooms", id, "players");
                    const since = Timestamp.fromMillis(
                      Date.now() - ACTIVE_WINDOW_MS
                    );
                    const q = query(coll, where("lastSeen", ">=", since));
                    const snap = await getCountFromServer(q);
                    const verified =
                      Number((snap.data() as any)?.count ?? 0) || 0;
                    const now2 = Date.now();
                    multiCheckCooldown[id] = now2 + 10_000; // 10s cooldown
                    if (verified > 0) {
                      // 本当の復帰。0固定を解除し、即時反映
                      zeroFreeze[id] = 0;
                      freezeTracker.end(id, now2);
                      applyCountUpdates(setCounts, { [id]: n });
                    } else {
                      // 残骸。0固定継続
                      applyCountUpdates(setCounts, { [id]: 0 });
                      // 現在のUID群をクオランティン
                      const present = presentUids || [];
                      if (present.length) {
                        if (!quarantine[id]) quarantine[id] = {};
                        for (const u of present) {
                          quarantine[id][u] = now2 + ZERO_FREEZE_MS_DEFAULT;
                        }
                      }
                    }
                  } catch {
                    // 検証失敗時は0固定継続
                    applyCountUpdates(setCounts, { [id]: 0 });
                  } finally {
                    multiCheckInflight[id] = false;
                  }
                })();
              } else {
                // クールダウン中は0固定
                queueCountUpdate(0);
              }
            } else {
              // JOIN兆候も検証も無い場合は freeze を維持
              queueCountUpdate(0);
            }
          } else {
            if (freezeUntil > 0) {
              zeroFreeze[id] = 0;
              freezeTracker.end(id, now);
            }
            queueCountUpdate(n);
          }
        applyCountUpdates(setCounts, queuedUpdates);
        };
        const onErr = () => applyCountUpdates(setCounts, { [id]: 0 });
        onValue(roomRef, handler, onErr as any);
        return () => off(roomRef, "value", handler);
      });
      return () => offs.forEach((fn) => fn());
    }

    // フォールバック: Firestore 集計クエリで players 件数を軽量取得
    // 常時 onSnapshot は使用せず、一定間隔でポーリング
    if (DISABLE_FS_FALLBACK) {
      // フラグ有効時は一切の読み取りを行わず、0固定にする
      setCounts((prev) => {
        const next: Record<string, number> = {};
        for (const id of roomIds) next[id] = 0;
        return next;
      });
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    // 0人からの反跳ね（lastSeenで近似カウントするため起こりやすい）を防ぐ
    // フォールバック時は ACTIVE_WINDOW_MS 中は 0 を維持する方が UX 的に合理的
    const zeroFreeze: Record<string, number> = {};
    const freezeTracker = createFreezeTracker("fallback");
    const envFallbackFreeze = Number(
      (process.env.NEXT_PUBLIC_LOBBY_ZERO_FREEZE_MS || "").toString()
    );
    const fallbackZeroBase =
      Number.isFinite(envFallbackFreeze) && envFallbackFreeze > 0
        ? envFallbackFreeze
        : ACTIVE_WINDOW_MS + 10_000;
    const FALLBACK_ZERO_FREEZE_MS = Math.min(fallbackZeroBase, 30_000);
    // デバッグ補助: 本来は presence を使う想定なので、フォールバック使用時に一度だけ警告
    if (typeof window !== "undefined") {
      logWarn("useLobbyCounts", "firestore-fallback", {});
    }

    const fetchCounts = async () => {

      if (cancelled) return;

      try {

        const entries = await Promise.all(

          roomIds.map(async (id) => {

            try {

              const coll = collection(db!, "rooms", id, "players");

              // lastSeen が直近 ACTIVE_WINDOW_MS 以内のプレイヤーをカウント

              const since = Timestamp.fromMillis(Date.now() - ACTIVE_WINDOW_MS);

              const q = query(coll, where("lastSeen", ">=", since));

              const snap = await getCountFromServer(q);

              // count は number | Long の可能性があるが、Web SDK は number を返す

              const n = (snap.data() as any)?.count ?? 0;

              return [id, Number(n) || 0] as const;

            } catch (err) {

              if (isFirebaseQuotaExceeded(err)) {

                handleFirebaseQuotaError("ルームカウント更新");

              }

              return [id, 0] as const;

            }

          })

        );

        const now = Date.now();

        const next: Record<string, number> = {};

        for (const [id, raw] of entries) {

          const freezeUntil = zeroFreeze[id] || 0;

          if (raw === 0) {

            zeroFreeze[id] = now + FALLBACK_ZERO_FREEZE_MS;

            freezeTracker.start(

              id,

              now,

              zeroFreeze[id],

              FALLBACK_ZERO_FREEZE_MS

            );

            next[id] = 0;

          } else {

            if (freezeUntil > 0) {

              zeroFreeze[id] = 0;

              freezeTracker.end(id, now);

            }

            next[id] = raw;

          }

        }

        if (!cancelled) applyCountUpdates(setCounts, next);

      } catch (err) {

        if (isFirebaseQuotaExceeded(err)) {

          handleFirebaseQuotaError("ルームカウント更新");

        }

        // noop

      }

    };

    const tick = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      )
        return;
      fetchCounts();
    };
    // 初回も可視時のみ実行し、非表示時の無駄な読取を回避
    if (
      typeof document === "undefined" ||
      document.visibilityState === "visible"
    ) {
      tick();
    }
    timer = setInterval(tick, 2 * 60 * 1000);

    return () => {
      cancelled = true;
      if (timer)
        try {
          clearInterval(timer);
        } catch {}
    };
  }, [firebaseEnabled, enabled, roomKey, refreshTrigger, excludeKey]);

  // refresh関数：手動でpresenceデータを再取得
  const refresh = () => setRefreshTrigger((prev) => prev + 1);

  return { counts, refresh };
}
