## Migration scripts

`migrate_clear_options.js` clears the `options.allowContinueAfterFail` property
from all room documents in Firestore. This is intended to be run by a project
administrator on a safe environment.

Prerequisites:

- Create a Firebase service account JSON and set the environment variable:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\service-account.json"
node scripts/migrate_clear_options.js
```

Notes:

- Ensure the service account has Firestore write permissions.
- This script updates all documents in the `rooms` collection; use with care.
