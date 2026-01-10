import { db } from "@/lib/firebase/client";
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
import {
  getVerificationHealth,
  shouldSkipVerification,
  updateHealthOnFailure,
  updateHealthOnSuccess,
  type VerificationHealth,
} from "@/lib/lobby/verificationHealth";
import { off, onValue, ref, type DataSnapshot, type Database } from "firebase/database";
import {
  Timestamp,
  collection,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore";
import type { Dispatch, SetStateAction } from "react";

import { applyCountUpdates } from "@/lib/hooks/lobbyCounts/applyCountUpdates";
import {
  derivePresenceCount,
  type PresenceRoomSnapshot,
} from "@/lib/hooks/lobbyCounts/derivePresenceCount";
import { createFreezeTracker } from "@/lib/hooks/lobbyCounts/freezeTracker";
import { recordLobbyMetric } from "@/lib/hooks/lobbyCounts/metrics";
import { readAggregateCount } from "@/lib/hooks/lobbyCounts/readAggregateCount";
import {
  DEFAULT_ACCEPT_FRESH_MS,
  computeLobbyStaleMs,
  computeZeroFreezeMsDefault,
  parseEnvBooleanFlag,
  parseEnvNumber,
} from "@/lib/hooks/lobbyCounts/presenceThresholds";

type VerificationCacheEntry = {
  count: number;
  expiresAt: number;
};
const CACHE_TTL_MS = 30_000;

export function subscribePresenceCounts(params: {
  normalizedRoomIds: readonly string[];
  setCounts: Dispatch<SetStateAction<Record<string, number>>>;
  rtdb: Database;
  excludeUidSet: ReadonlySet<string>;
  disableFsFallback: boolean;
  debugFallback: boolean;
  verificationStateRef: {
    current: {
      cache: Map<string, VerificationCacheEntry>;
      health: Map<string, VerificationHealth>;
    };
  };
  verificationLastCheckRef: {
    current: {
      single: Record<string, number>;
      multi: Record<string, number>;
    };
  };
}): () => void {
  const {
    normalizedRoomIds,
    setCounts,
    rtdb,
    excludeUidSet,
    disableFsFallback,
    debugFallback,
    verificationStateRef,
    verificationLastCheckRef,
  } = params;

  const freezeTracker = createFreezeTracker("presence");
  const DEBUG_UIDS =
    typeof process !== "undefined" &&
    parseEnvBooleanFlag(process.env.NEXT_PUBLIC_LOBBY_DEBUG_UIDS);
  // 既定値は OFF（読み取り節約）。必要時のみ .env で有効化
  const VERIFY_SINGLE =
    typeof process !== "undefined" &&
    parseEnvBooleanFlag(process.env.NEXT_PUBLIC_LOBBY_VERIFY_SINGLE);
  const VERIFY_MULTI =
    typeof process !== "undefined" &&
    parseEnvBooleanFlag(process.env.NEXT_PUBLIC_LOBBY_VERIFY_MULTI);

  // ロビー表示はゴースト抑制のため、presenceの鮮度しきい値をさらに短めに（既定8s）
  const ENV_STALE = parseEnvNumber(process.env.NEXT_PUBLIC_LOBBY_STALE_MS);
  const LOBBY_STALE_MS = computeLobbyStaleMs({
    envStaleMs: ENV_STALE,
    presenceStaleMs: PRESENCE_STALE_MS,
    heartbeatMs: PRESENCE_HEARTBEAT_MS,
  });
  // 0人からの反跳ね（古いconnが遅れて現れる）を防ぐためのクールダウン
  const zeroFreeze: Record<string, number> = {};
  // 据え置きの既定値（必要なら環境変数で短縮/延長）
  const ENV_ZERO_FREEZE = parseEnvNumber(process.env.NEXT_PUBLIC_LOBBY_ZERO_FREEZE_MS);
  const ZERO_FREEZE_MS_DEFAULT = computeZeroFreezeMsDefault({
    envZeroFreezeMs: ENV_ZERO_FREEZE,
    lobbyStaleMs: LOBBY_STALE_MS,
  }); // stale超え+αで安全側に
  // 新規参加を即時に検出するための“新鮮さ”しきい値（5秒以内のtsがあればフリーズ解除）
  const ACCEPT_FRESH_MS = DEFAULT_ACCEPT_FRESH_MS;

  // 一度だけデバッグ情報を表示（presentモードの有効値）
  if (typeof window !== "undefined") {
    logInfo("useLobbyCounts", "presence-config", {
      staleMs: LOBBY_STALE_MS,
      zeroFreezeMs: ZERO_FREEZE_MS_DEFAULT,
      acceptFreshMs: ACCEPT_FRESH_MS,
      excludeCount: excludeUidSet.size,
    });
  }

  // n===1 のときだけ行う軽量検証のスロットル管理
  const singleCheckInflight: Record<string, boolean> = {};
  const singleCheckCooldown: Record<string, number> = {};
  const multiCheckInflight: Record<string, boolean> = {};
  const multiCheckCooldown: Record<string, number> = {};

  {
    const { cache, health } = verificationStateRef.current;
    const active = new Set(normalizedRoomIds);
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

  const offs = normalizedRoomIds.map((id) => {
    const roomRef = ref(rtdb, `presence/${id}`);
    const handler = (snap: DataSnapshot) => {
      const queuedUpdates: Record<string, number> = {};
      const queueCountUpdate = (value: number) => {
        queuedUpdates[id] = value;
      };

      const now = Date.now();
      const users = (snap.val() || {}) as PresenceRoomSnapshot; // uid -> connId -> { ts }
      const presence = derivePresenceCount({
        users,
        excludeUidSet,
        now,
        maxClockSkewMs: MAX_CLOCK_SKEW_MS,
        staleMs: LOBBY_STALE_MS,
        acceptFreshMs: ACCEPT_FRESH_MS,
        debugUids: DEBUG_UIDS,
        roomQuarantine: quarantine[id],
      });
      quarantine[id] = presence.roomQuarantine;
      const n = presence.count;
      const hasFresh = presence.hasFresh;
      const includedUids = presence.includedUids;
      const presentUids = presence.presentUids;

      if (DEBUG_UIDS) {
        try {
          logDebug("useLobbyCounts", "presence-room", {
            roomId: id,
            present: presentUids?.join(",") || "-",
            excluded: excludeUidSet.size,
            included: includedUids?.join(",") || "-",
            count: n,
          });
        } catch {}
      }

      // 0表示の検証（n===1 のときのみ）。presence の残骸が 1 だけ残って見えるケースの対策。
      if (VERIFY_SINGLE && n === 1 && !disableFsFallback) {
        const { cache, health: healthStore } = verificationStateRef.current;
        const healthEntry = getVerificationHealth(healthStore, id, now);
        const cached = cache.get(id);
        if (cached && cached.expiresAt > now) {
          if (cached.count === 0) {
            queueCountUpdate(0);
          }
          updateHealthOnSuccess(healthEntry, now);
          verificationLastCheckRef.current.single[id] = now;
          singleCheckCooldown[id] = now + healthEntry.backoffMs;
        } else {
          const lastCheck = verificationLastCheckRef.current.single[id] || 0;
          const nextAllowed = singleCheckCooldown[id] || 0;
          if (shouldSkipVerification(healthEntry, lastCheck, now) || now < nextAllowed) {
            singleCheckCooldown[id] = Math.max(nextAllowed, now + healthEntry.backoffMs);
          } else if (!singleCheckInflight[id]) {
            singleCheckInflight[id] = true;
            const perf =
              typeof window !== "undefined" && typeof window.performance !== "undefined"
                ? window.performance
                : null;
            perf?.mark(`lobby_fallback_single_start:${id}`);
            (async () => {
              try {
                const coll = collection(db!, "rooms", id, "players");
                const since = Timestamp.fromMillis(Date.now() - ACTIVE_WINDOW_MS);
                const q = query(coll, where("lastSeen", ">=", since));
                const snap = await getCountFromServer(q);
                const verified = readAggregateCount(snap);
                const now2 = Date.now();
                cache.set(id, { count: verified, expiresAt: now2 + CACHE_TTL_MS });
                verificationLastCheckRef.current.single[id] = now2;
                updateHealthOnSuccess(healthEntry, now2);
                singleCheckCooldown[id] = now2 + healthEntry.backoffMs;
                if (verified === 0) {
                  const freezeUntil = now2 + ZERO_FREEZE_MS_DEFAULT;
                  zeroFreeze[id] = freezeUntil;
                  freezeTracker.start(id, now2, freezeUntil, ZERO_FREEZE_MS_DEFAULT);
                  applyCountUpdates(setCounts, { [id]: 0 });
                  const suspect = (includedUids && includedUids[0]) || undefined;
                  if (suspect) {
                    if (!quarantine[id]) quarantine[id] = {};
                    quarantine[id][suspect] = now2 + ZERO_FREEZE_MS_DEFAULT;
                  }
                  if (DEBUG_UIDS || debugFallback) {
                    try {
                      logDebug("useLobbyCounts", "verify-single-zero", {
                        roomId: id,
                        freezeMs: ZERO_FREEZE_MS_DEFAULT,
                        suspect: suspect || "-",
                      });
                    } catch {}
                  }
                } else if (verified > 0 && debugFallback) {
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
                updateHealthOnFailure(healthEntry, now);
                singleCheckCooldown[id] = verificationLastCheckRef.current.single[id] + healthEntry.backoffMs;
                if (isFirebaseQuotaExceeded(error)) {
                  handleFirebaseQuotaError("ロビー人数検証");
                }
                if (debugFallback) {
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
                  typeof window !== "undefined" && typeof window.performance !== "undefined"
                    ? window.performance
                    : null;
                try {
                  endPerf?.measure(
                    `lobby_fallback_single:${id}`,
                    `lobby_fallback_single_start:${id}`
                  );
                  const entry = endPerf?.getEntriesByName(`lobby_fallback_single:${id}`).pop();
                  if (entry) {
                    recordLobbyMetric("fallback_single", entry.duration, id);
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
      if (VERIFY_MULTI && n > 0 && !disableFsFallback) {
        const { cache, health: healthStore } = verificationStateRef.current;
        const healthEntry = getVerificationHealth(healthStore, id, now);
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
          updateHealthOnSuccess(healthEntry, now);
          verificationLastCheckRef.current.multi[id] = now;
          multiCheckCooldown[id] = now + healthEntry.backoffMs;
          if (debugFallback) {
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
          if (shouldSkipVerification(healthEntry, lastCheck, now) || now < nextAllowed) {
            if (debugFallback) {
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
            multiCheckCooldown[id] = Math.max(nextAllowed, now + healthEntry.backoffMs);
          } else if (!multiCheckInflight[id]) {
            multiCheckInflight[id] = true;
            const perf =
              typeof window !== "undefined" && typeof window.performance !== "undefined"
                ? window.performance
                : null;
            perf?.mark(`lobby_fallback_multi_start:${id}`);
            (async () => {
              try {
                const coll = collection(db!, "rooms", id, "players");
                const since = Timestamp.fromMillis(Date.now() - ACTIVE_WINDOW_MS);
                const q = query(coll, where("lastSeen", ">=", since));
                const snap = await getCountFromServer(q);
                const verified = readAggregateCount(snap);
                const now2 = Date.now();
                cache.set(id, { count: verified, expiresAt: now2 + CACHE_TTL_MS });
                verificationLastCheckRef.current.multi[id] = now2;
                updateHealthOnSuccess(healthEntry, now2);
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
                } else if (debugFallback) {
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
                updateHealthOnFailure(healthEntry, verificationLastCheckRef.current.multi[id]);
                multiCheckCooldown[id] =
                  verificationLastCheckRef.current.multi[id] + healthEntry.backoffMs;
                if (isFirebaseQuotaExceeded(error)) {
                  handleFirebaseQuotaError("ロビー人数検証");
                }
                if (debugFallback) {
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
                  typeof window !== "undefined" && typeof window.performance !== "undefined"
                    ? window.performance
                    : null;
                try {
                  endPerf?.measure(
                    `lobby_fallback_multi:${id}`,
                    `lobby_fallback_multi_start:${id}`
                  );
                  const entry = endPerf?.getEntriesByName(`lobby_fallback_multi:${id}`).pop();
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
        freezeTracker.start(id, now, zeroFreeze[id], ZERO_FREEZE_MS_DEFAULT);
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
                const since = Timestamp.fromMillis(Date.now() - ACTIVE_WINDOW_MS);
                const q = query(coll, where("lastSeen", ">=", since));
                const snap = await getCountFromServer(q);
                const verified = readAggregateCount(snap);
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
    onValue(roomRef, handler, onErr);
    return () => off(roomRef, "value", handler);
  });

  return () => {
    offs.forEach((fn) => {
      fn();
    });
  };
}
