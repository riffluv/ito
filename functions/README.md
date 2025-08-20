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
