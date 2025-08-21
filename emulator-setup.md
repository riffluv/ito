# Firebase Emulator quick setup

1. Install firebase tools globally (if not installed):

```powershell
npm i -g firebase-tools
```

2. Start the emulators (from repository root):

```powershell
firebase emulators:start --only auth,firestore,database
```

3. In client code, connect to local emulators when running locally, e.g.:

```ts
import { getDatabase, connectDatabaseEmulator } from "firebase/database";
const rtdb = getDatabase(app);
connectDatabaseEmulator(rtdb, "localhost", 9000);

import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
const fs = getFirestore(app);
connectFirestoreEmulator(fs, "localhost", 8080);

import { getAuth, connectAuthEmulator } from "firebase/auth";
const auth = getAuth(app);
connectAuthEmulator(auth, "http://localhost:9099");
```

4. Useful UI: http://localhost:4000

Note: Emulator data is local-only and good for integration tests and debugging presence logic.
