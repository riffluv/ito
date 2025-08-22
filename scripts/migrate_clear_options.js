/**
 * Simple migration script to clear `options.allowContinueAfterFail` from all rooms.
 * Run locally with proper Firebase admin credentials.
 *
 * Usage:
 *   node scripts/migrate_clear_options.js
 *
 * Ensure you have set the environment variable GOOGLE_APPLICATION_CREDENTIALS
 * pointing to a service account JSON with Firestore write access.
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function migrate() {
  console.log(
    "Starting migration: clear options.allowContinueAfterFail on all rooms..."
  );
  const roomsSnap = await db.collection("rooms").get();
  console.log(`Found ${roomsSnap.size} rooms`);
  let count = 0;
  for (const doc of roomsSnap.docs) {
    const data = doc.data();
    const options = data.options || {};
    if (
      Object.prototype.hasOwnProperty.call(options, "allowContinueAfterFail")
    ) {
      delete options.allowContinueAfterFail;
      await doc.ref.update({ options });
      count += 1;
      console.log(`Updated ${doc.id}`);
    }
  }
  console.log(`Migration complete, updated ${count} rooms.`);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
