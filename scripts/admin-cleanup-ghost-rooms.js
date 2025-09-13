/**
 * 管理スクリプト: ゴースト部屋（0人で古いもの）を安全に削除
 * 条件:
 *  - RTDB presence が 0（オンラインなし）
 *  - players.lastSeen がしきい値以上 古い（=最近のアクティビティなし）
 *  - 最終更新（lastActiveAt/createdAt の新しい方）も十分に古い
 *  - 進行中っぽい status は一旦 waiting に落としてから削除
 *
 * 使い方:
 *  - GOOGLE_APPLICATION_CREDENTIALS か service-account-key.json を用意
 *  - NEXT_PUBLIC_FIREBASE_PROJECT_ID / NEXT_PUBLIC_FIREBASE_DATABASE_URL を .env.local に設定済み
 *  - 実行: node scripts/admin-cleanup-ghost-rooms.js
 *    - DRY_RUN=1 を付けると削除せず候補のみ表示
 *    - しきい値: GHOST_STALE_LASTSEEN_MS (default 10min), GHOST_ROOM_MIN_AGE_MS (default 30min), PRESENCE_STALE_MS (default 90s)
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function loadEnvLocal() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const [, k, v] = m;
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}

async function ensureAdmin() {
  if (admin.apps.length) return;
  // 1) GOOGLE_APPLICATION_CREDENTIALS があればそのまま
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || undefined,
    });
    return;
  }
  // 2) service-account-key.json を探す
  const keyPath = path.join(process.cwd(), 'service-account-key.json');
  if (fs.existsSync(keyPath)) {
    const serviceAccount = require(keyPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || undefined,
    });
    return;
  }
  throw new Error('Service account credentials not found. Set GOOGLE_APPLICATION_CREDENTIALS or place service-account-key.json');
}

function toMillis(v) {
  if (!v) return 0;
  if (typeof v === 'object' && typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  return 0;
}

async function main() {
  loadEnvLocal();
  await ensureAdmin();
  const db = admin.firestore();
  const rtdb = admin.database();

  const NOW = Date.now();
  const STALE_LASTSEEN_MS = Number(process.env.GHOST_STALE_LASTSEEN_MS) || 10 * 60 * 1000; // 10min
  const ROOM_MIN_AGE_MS = Number(process.env.GHOST_ROOM_MIN_AGE_MS) || 30 * 60 * 1000; // 30min
  const PRESENCE_STALE_MS = Number(process.env.PRESENCE_STALE_MS) || 90_000; // 90s
  const DRY_RUN = !!(process.env.DRY_RUN && process.env.DRY_RUN !== '0' && process.env.DRY_RUN.toLowerCase() !== 'false');

  console.log(`[admin-cleanup-ghost] start: lastSeen>${STALE_LASTSEEN_MS}ms, age>${ROOM_MIN_AGE_MS}ms, presenceStale=${PRESENCE_STALE_MS}ms, dryRun=${DRY_RUN}`);

  const snap = await db.collection('rooms').get();
  if (snap.empty) {
    console.log('no rooms');
    return;
  }

  let candidates = 0;
  let deleted = 0;

  for (const doc of snap.docs) {
    const room = doc.data() || {};
    const roomId = doc.id;

    // age gate
    const newerMs = Math.max(toMillis(room.lastActiveAt), toMillis(room.createdAt));
    const ageMs = newerMs ? NOW - newerMs : Number.POSITIVE_INFINITY;
    if (ageMs < ROOM_MIN_AGE_MS) continue;

    // presence count
    let presenceCount = 0;
    try {
      const presSnap = await rtdb.ref(`presence/${roomId}`).get();
      if (presSnap.exists()) {
        const val = presSnap.val() || {};
        const nowLocal = Date.now();
        for (const uid of Object.keys(val)) {
          const conns = val[uid] || {};
          const online = Object.values(conns).some((c) => {
            const ts = typeof c?.ts === 'number' ? c.ts : 0;
            if (!ts) return false;
            if (ts - nowLocal > PRESENCE_STALE_MS) return false;
            return nowLocal - ts <= PRESENCE_STALE_MS;
          });
          if (online) presenceCount++;
        }
      }
    } catch {}
    if (presenceCount > 0) continue;

    // recent players by lastSeen
    const playersSnap = await doc.ref.collection('players').get();
    let recentPlayers = 0;
    for (const p of playersSnap.docs) {
      const ls = (p.data() || {}).lastSeen;
      const ms = toMillis(ls);
      if (ms && NOW - ms <= STALE_LASTSEEN_MS) recentPlayers++;
    }
    if (recentPlayers > 0) continue;

    // protect in-progress by first resetting status to waiting
    const isInProgress = room.status && room.status !== 'waiting' && room.status !== 'completed';
    candidates++;
    console.log(`[candidate] ${roomId} name=${room.name || '-'} age=${Math.round(ageMs/1000)}s presence=${presenceCount} recentPlayers=${recentPlayers}`);

    if (DRY_RUN) continue;

    try {
      if (isInProgress) await doc.ref.update({ status: 'waiting' });
    } catch {}

    // delete chat
    try {
      const chatRefs = await doc.ref.collection('chat').listDocuments();
      if (chatRefs.length) {
        const b = db.batch();
        for (const c of chatRefs) b.delete(c);
        await b.commit();
      }
    } catch {}

    // delete players
    try {
      const playerRefs = await doc.ref.collection('players').listDocuments();
      if (playerRefs.length) {
        const b = db.batch();
        for (const p of playerRefs) b.delete(p);
        await b.commit();
      }
    } catch {}

    // delete presence node (best-effort)
    try { await rtdb.ref(`presence/${roomId}`).remove(); } catch {}

    // delete room
    try { await doc.ref.delete(); deleted++; console.log('  -> deleted'); } catch (e) { console.error('  -> failed to delete', e); }
  }

  console.log(`[admin-cleanup-ghost] done. candidates=${candidates} deleted=${deleted}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

