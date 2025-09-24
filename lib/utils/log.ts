type Level = "silent" | "error" | "warn" | "info" | "debug";

const LEVEL_ORDER: Level[] = ["silent", "error", "warn", "info", "debug"];
const LEVEL_RANK = new Map<Level, number>(LEVEL_ORDER.map((lvl, idx) => [lvl, idx]));
const DEFAULT_LEVEL: Level = "info";

function parseLevel(raw: string | undefined): Level | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  return LEVEL_ORDER.includes(normalized as Level) ? (normalized as Level) : null;
}

// 環境変数を評価（サーバー側: LOG_LEVEL 優先 / クライアント側: NEXT_PUBLIC_LOG_LEVEL）
const SERVER_LEVEL = parseLevel(process.env.LOG_LEVEL) ?? parseLevel(process.env.NEXT_PUBLIC_LOG_LEVEL);
const CLIENT_LEVEL = parseLevel(process.env.NEXT_PUBLIC_LOG_LEVEL);

function currentLevel(): Level {
  if (typeof window === "undefined") {
    return SERVER_LEVEL ?? DEFAULT_LEVEL;
  }
  return CLIENT_LEVEL ?? DEFAULT_LEVEL;
}

function enabled(level: Level) {
  const current = currentLevel();
  const currentRank = LEVEL_RANK.get(current) ?? LEVEL_RANK.get(DEFAULT_LEVEL)!;
  const targetRank = LEVEL_RANK.get(level) ?? LEVEL_RANK.get(DEFAULT_LEVEL)!;
  return targetRank <= currentRank;
}

function emit(level: "debug" | "info" | "warn" | "error", scope: string, msg: string, data?: unknown) {
  if (!enabled(level === "debug" ? "debug" : level === "info" ? "info" : level === "warn" ? "warn" : "error")) {
    return;
  }

  const payload = data === undefined ? undefined : data;
  const prefix = `[${scope}] ${msg}`;

  switch (level) {
    case "debug":
      payload === undefined ? console.debug(prefix) : console.debug(prefix, payload);
      break;
    case "info":
      payload === undefined ? console.info(prefix) : console.info(prefix, payload);
      break;
    case "warn":
      payload === undefined ? console.warn(prefix) : console.warn(prefix, payload);
      break;
    case "error":
      payload === undefined ? console.error(prefix) : console.error(prefix, payload);
      break;
  }
}

export function logDebug(scope: string, msg: string, data?: any) {
  emit("debug", scope, msg, data);
}
export function logInfo(scope: string, msg: string, data?: any) {
  emit("info", scope, msg, data);
}
export function logWarn(scope: string, msg: string, data?: any) {
  emit("warn", scope, msg, data);
}
export function logError(scope: string, msg: string, data?: any) {
  emit("error", scope, msg, data);
}
