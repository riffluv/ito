"use client";
import { db, firebaseEnabled, rtdb } from "@/lib/firebase/client";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
import {
  MAX_CLOCK_SKEW_MS,
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_STALE_MS,
  presenceSupported,
} from "@/lib/firebase/presence";
import { ACTIVE_WINDOW_MS } from "@/lib/time";
import { off, onValue, ref } from "firebase/database";
import {
  Timestamp,
  collection,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

export type UseLobbyCountsOptions = {
  // 自分自身や特定UIDをカウントから除外（ロビー表示で「他人数」を出したい場合や、
  // 退出直後の自身ゴースト対策として有効）
  excludeUid?: string | string[];
};

export function useLobbyCounts(
  roomIds: string[],
  enabled: boolean,
  options?: UseLobbyCountsOptions
) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // 緊急時に Firestore フォールバックを完全停止するフラグ（.env から）
  const DISABLE_FS_FALLBACK =
    typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_DISABLE_FS_FALLBACK?.toString() === "1" ||
      process.env.NEXT_PUBLIC_DISABLE_FS_FALLBACK?.toLowerCase() === "true");

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
      const DEBUG_UIDS =
        typeof process !== "undefined" &&
        ((process.env.NEXT_PUBLIC_LOBBY_DEBUG_UIDS || "").toString() === "1" ||
          (process.env.NEXT_PUBLIC_LOBBY_DEBUG_UIDS || "")
            .toString()
            .toLowerCase() === "true");
      const VERIFY_SINGLE =
        typeof process !== "undefined" &&
        ((process.env.NEXT_PUBLIC_LOBBY_VERIFY_SINGLE || "").toString() ===
          "1" ||
          (process.env.NEXT_PUBLIC_LOBBY_VERIFY_SINGLE || "")
            .toString()
            .toLowerCase() === "true");
      const excludeSet = new Set(
        Array.isArray(options?.excludeUid)
          ? options!.excludeUid
          : options?.excludeUid
            ? [options.excludeUid]
            : []
      );
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
        // eslint-disable-next-line no-console
        console.info(
          `[useLobbyCounts] presence mode: stale=${LOBBY_STALE_MS}ms, zeroFreeze=${ZERO_FREEZE_MS_DEFAULT}ms, acceptFresh=${ACCEPT_FRESH_MS}ms, excludeUids=${excludeSet.size}`
        );
      }
      // n===1 のときだけ行う軽量検証のスロットル管理
      const singleCheckInflight: Record<string, boolean> = {};
      const singleCheckCooldown: Record<string, number> = {};
      // players=0 と検証された単独UIDを一時的に無視するクオランティン
      const quarantine: Record<string, Record<string, number>> = {};

      const offs = roomIds.map((id) => {
        const roomRef = ref(rtdb!, `presence/${id}`);
        const handler = (snap: any) => {
          const users = (snap.val() || {}) as Record<
            string,
            Record<string, any>
          >; // uid -> connId -> { ts }
          let n = 0;
          const now = Date.now();
          let hasFresh = false; // 直近JOIN（5s以内）の兆候
          let includedUids: string[] | undefined = DEBUG_UIDS ? [] : undefined;
          let presentUids: string[] | undefined = DEBUG_UIDS
            ? Object.keys(users)
            : undefined;
          for (const uid of Object.keys(users)) {
            if (excludeSet.has(uid)) continue; // 自身など除外対象はスキップ
            const conns = users[uid] || {};
            // より厳格な判定：最新の有効なタイムスタンプのみ
            let latestValidTs = 0;
            for (const c of Object.values(conns) as any[]) {
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
              // eslint-disable-next-line no-console
              console.debug(
                `[useLobbyCounts] room=${id} present=${presentUids?.join(",") || "-"} excludeSet=${
                  excludeSet.size
                } included=${includedUids?.join(",") || "-"} count=${n}`
              );
            } catch {}
          }
          // 特殊対策: n===1 の場合だけ、players コレクションのサーバカウントで検証（任意有効化）。
          // もし players=0 なら、presence の一時的な残骸とみなし 0 に矯正しゼロフリーズ開始。
          if (VERIFY_SINGLE && n === 1) {
            const cd = singleCheckCooldown[id] || 0;
            if (!singleCheckInflight[id] && now >= cd) {
              singleCheckInflight[id] = true;
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
                  singleCheckCooldown[id] = now2 + 10_000; // 10s クールダウン
                  if (verified === 0) {
                    // 残骸と判断し 0 に矯正 + ゼロフリーズ
                    const freezeUntil = now2 + ZERO_FREEZE_MS_DEFAULT;
                    zeroFreeze[id] = freezeUntil;
                    setCounts((prev) => ({ ...prev, [id]: 0 }));
                    // 単独で数えられていたUIDを一定時間クオランティン
                    const suspect =
                      (includedUids && includedUids[0]) || undefined;
                    if (suspect) {
                      if (!quarantine[id]) quarantine[id] = {};
                      quarantine[id][suspect] = now2 + ZERO_FREEZE_MS_DEFAULT;
                    }
                    if (DEBUG_UIDS) {
                      try {
                        // eslint-disable-next-line no-console
                        console.debug(
                          `[useLobbyCounts] room=${id} single-verify -> players=0, force 0 (freeze ${ZERO_FREEZE_MS_DEFAULT}ms), quarantine=${suspect || "-"}`
                        );
                      } catch {}
                    }
                  }
                } catch {
                } finally {
                  singleCheckInflight[id] = false;
                }
              })();
            }
          }
          // 0→N と跳ね返る現象の緩和：0になった直後は一定時間0のまま据え置く
          const freezeUntil = zeroFreeze[id] || 0;
          if (n === 0) {
            zeroFreeze[id] = now + ZERO_FREEZE_MS_DEFAULT; // 0表示を据え置き
            setCounts((prev) => ({ ...prev, [id]: 0 }));
          } else if (now < freezeUntil && !hasFresh) {
            // クールダウン中は0のまま（ただし“新鮮”なJOINがあれば即解除）
            setCounts((prev) => ({ ...prev, [id]: 0 }));
          } else {
            setCounts((prev) => ({ ...prev, [id]: n }));
          }
        };
        const onErr = () => setCounts((prev) => ({ ...prev, [id]: 0 }));
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
    const FALLBACK_ZERO_FREEZE_MS = Math.max(
      // 任意オーバーライド（あれば使用）
      Number((process.env.NEXT_PUBLIC_LOBBY_ZERO_FREEZE_MS || "").toString()) ||
        0,
      // 最低でも lastSeen の活動窓 + 10s は 0 を維持
      ACTIVE_WINDOW_MS + 10_000
    );
    // デバッグ補助: 本来は presence を使う想定なので、フォールバック使用時に一度だけ警告
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.warn(
        "[useLobbyCounts] Using Firestore count() fallback (presence unsupported or misconfigured). Consider setting NEXT_PUBLIC_FIREBASE_DATABASE_URL and NEXT_PUBLIC_DISABLE_FS_FALLBACK=1."
      );
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
              // count は number | Long 相当だが、Web SDK は number を返す
              const n = (snap.data() as any)?.count ?? 0;
              return [id, Number(n) || 0] as const;
            } catch (err) {
              if (isFirebaseQuotaExceeded(err)) {
                handleFirebaseQuotaError("ルーム人数カウント");
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
            next[id] = 0;
          } else if (now < freezeUntil) {
            // クールダウン中は 0 を維持
            next[id] = 0;
          } else {
            next[id] = raw;
          }
        }
        if (!cancelled) setCounts((prev) => ({ ...prev, ...next }));
      } catch (err) {
        if (isFirebaseQuotaExceeded(err)) {
          handleFirebaseQuotaError("ルームカウント更新");
        }
        // noop
      }
    };

    // 初回 + 2分間隔で更新（ロビーの人数表示は近似で十分）
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
  }, [firebaseEnabled, enabled, roomKey, refreshTrigger, options?.excludeUid]);

  // refresh関数：手動でpresenceデータを再取得
  const refresh = () => setRefreshTrigger((prev) => prev + 1);

  return { counts, refresh };
}
