Functions to maintain rooms.playersCount and playersLastActive.

How it works:
- Triggers onCreate/onDelete/onUpdate for `rooms/{roomId}/players/{playerId}`.
- Recalculates playersCount and playersLastActive by scanning players subcollection and updates `rooms/{roomId}` via transaction.

Safety and costs:
- Scanning the players subcollection is O(players). Keep player count per room modest (<100) for cost control.
- If you expect large player lists, consider maintaining counters at write time from the app or using a separate lightweight counter document.

Deploy:
1. cd functions
2. npm install
3. npx firebase deploy --only functions
# Functions for ITO

This folder contains Firebase Cloud Functions used by the ITO project.

- `cleanupExpiredRooms`: scheduled Pub/Sub function that deletes `rooms` documents whose `expiresAt` timestamp has passed. It also deletes `players` and `chat` subcollection documents.

Local testing

1. Install dependencies:

```bash
cd functions
npm install
```

2. Build (optional, TypeScript):

```bash
npm run build
```

3. Start emulator:

```bash
npm run serve
```

Deployment

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

Notes

- The function uses `listDocuments()` + batched deletes. For very large collections consider an iterative approach or Firestore export/import.
- Adjust schedule frequency (currently `every 10 minutes`) according to needs and billing constraints.
