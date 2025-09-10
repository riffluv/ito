Admin scripts

This folder contains helper scripts to maintain RTDB presence and remove ghost rooms.

- `admin-purge-presence.ts` - removes stale presence entries from RTDB. Use when presence nodes persist after crashes.
- `admin-purge-ghost-rooms.ts` - detects rooms with no presence and no players and deletes them. Supports dry-run with `DRY_RUN=1`.

Run with `ts-node` or compile with `tsc` and run with `node`. Ensure GOOGLE_APPLICATION_CREDENTIALS points to a service account JSON with appropriate permissions.
