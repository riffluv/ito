const STORAGE_VERSION_KEY = "ito:storage-version";
const CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "dev";

const KEYS_TO_CLEAR = [
  "lastRoom",
  "backgroundType",
  "defaultTopicType",
  "gameSettings",
  "force-animations",
  "force-3d-transforms",
  "ito:sound:settings:v1",
];

const PREFIXES_TO_CLEAR = [
  "ito:round:",
  "ito:sound:",
  "ito:settings",
];

const hasLocalStorage = () => {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
};

export function ensureStorageSchema() {
  if (!hasLocalStorage()) return;

  try {
    const storedVersion = window.localStorage.getItem(STORAGE_VERSION_KEY);
    if (storedVersion === CURRENT_VERSION) return;

    if (storedVersion !== null) {
      const keys = Object.keys(window.localStorage);
      for (const key of keys) {
        if (KEYS_TO_CLEAR.includes(key) || PREFIXES_TO_CLEAR.some((prefix) => key.startsWith(prefix))) {
          try {
            window.localStorage.removeItem(key);
          } catch {}
        }
      }
    }

    window.localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
  } catch {
    // ignore storage errors
  }
}

