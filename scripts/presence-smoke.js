/*
  Simple smoke test for RTDB presence behavior.
  Usage: node scripts/presence-smoke.js <databaseURL> <roomId> <uid>

  This script uses the Firebase Web SDK to:
  - create two pushed presence connections under presence/<roomId>/<uid>
  - verify that reading the list shows 2 connections
  - remove one connection and verify it becomes 1

  This doesn't require service account credentials because it uses the client SDK
  and assumes the RTDB has permissive rules for testing, or you run it with
  a test user who can write.
*/

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, push, set, remove, onValue, serverTimestamp } = require('firebase/database');

if (process.argv.length < 5) {
  console.error('Usage: node scripts/presence-smoke.js <databaseURL> <roomId> <uid>');
  process.exit(2);
}

const databaseURL = process.argv[2];
const roomId = process.argv[3];
const uid = process.argv[4];

const config = {
  // minimal config - only databaseURL is required for RTDB operations in test
  databaseURL,
};

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  const app = initializeApp(config);
  const db = getDatabase(app);

  const base = `presence/${roomId}/${uid}`;
  console.log('Base path:', base);

  // push two connections
  const aRef = push(ref(db, base));
  const bRef = push(ref(db, base));

  await set(aRef, { online: true, ts: serverTimestamp() });
  await set(bRef, { online: true, ts: serverTimestamp() });

  console.log('Added two connections, waiting for RTDB to settle...');
  await sleep(1500);

  // read once
  let latest = null;
  await new Promise((resolve) => {
    onValue(ref(db, base), (snap) => {
      const v = snap.val() || {};
      const keys = Object.keys(v);
      console.log('Current keys:', keys);
      latest = keys;
      resolve();
    }, { onlyOnce: true });
  });

  if (!latest || latest.length < 2) {
    console.error('Expected at least 2 connections, got', latest && latest.length);
    process.exit(1);
  }

  console.log('Now removing one connection...');
  await remove(aRef);
  await sleep(1000);

  await new Promise((resolve) => {
    onValue(ref(db, base), (snap) => {
      const v = snap.val() || {};
      const keys = Object.keys(v);
      console.log('After remove, keys:', keys);
      if (keys.length === 1) {
        console.log('Smoke test OK');
        resolve();
      } else {
        console.error('After remove expected 1, got', keys.length);
        resolve();
      }
    }, { onlyOnce: true });
  });

  // cleanup
  try { await remove(bRef); } catch {};
  console.log('Cleanup done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error in smoke test:', err);
  process.exit(1);
});
