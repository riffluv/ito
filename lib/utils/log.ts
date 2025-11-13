type Level = "silent" | "error" | "warn" | "info" | "debug";

const LEVEL_ORDER: Level[] = ["silent", "error", "warn", "info", "debug"];
const LEVEL_RANK = new Map<Level, number>(
  LEVEL_ORDER.map((lvl, idx) => [lvl, idx])
);
const DEFAULT_LEVEL: Level = "info";

type ConsoleTransport = Pick<Console, "debug" | "info" | "warn" | "error">;
const silentConsole: ConsoleTransport = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
function getConsole(): ConsoleTransport {
  return (typeof globalThis !== "undefined" && globalThis.console) || silentConsole;
}

const isProdBuild = process.env.NODE_ENV === "production";
const isVercel = process.env.VERCEL === "1";

function parseLevel(raw: string | undefined): Level | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  return LEVEL_ORDER.includes(normalized as Level)
    ? (normalized as Level)
    : null;
}

// 環境変数を評価（サーバー側: LOG_LEVEL 優先 / クライアント側: NEXT_PUBLIC_LOG_LEVEL）
const SERVER_ENV_LEVEL =
  parseLevel(process.env.LOG_LEVEL) ??
  parseLevel(process.env.NEXT_PUBLIC_LOG_LEVEL);
const CLIENT_ENV_LEVEL = parseLevel(process.env.NEXT_PUBLIC_LOG_LEVEL);

const DEFAULT_SERVER_LEVEL: Level =
  isVercel || isProdBuild ? "warn" : DEFAULT_LEVEL;
const DEFAULT_CLIENT_LEVEL: Level = isProdBuild ? "warn" : DEFAULT_LEVEL;

function currentLevel(): Level {
  if (typeof window === "undefined") {
    return SERVER_ENV_LEVEL ?? DEFAULT_SERVER_LEVEL;
  }
  return CLIENT_ENV_LEVEL ?? DEFAULT_CLIENT_LEVEL;
}

function enabled(level: Level) {
  const current = currentLevel();
  const currentRank = LEVEL_RANK.get(current) ?? LEVEL_RANK.get(DEFAULT_LEVEL)!;
  const targetRank = LEVEL_RANK.get(level) ?? LEVEL_RANK.get(DEFAULT_LEVEL)!;
  return targetRank <= currentRank;
}

function emit(
  level: "debug" | "info" | "warn" | "error",
  scope: string,
  msg: string,
  data?: unknown
) {
  if (!enabled(level)) {
    return;
  }

  const payload = data === undefined ? undefined : data;
  const prefix = `[${scope}] ${msg}`;
  const target = getConsole();

  switch (level) {
    case "debug":
      if (payload === undefined) {
        target.debug(prefix);
      } else {
        target.debug(prefix, payload);
      }
      break;
    case "info":
      if (payload === undefined) {
        target.info(prefix);
      } else {
        target.info(prefix, payload);
      }
      break;
    case "warn":
      if (payload === undefined) {
        target.warn(prefix);
      } else {
        target.warn(prefix, payload);
      }
      break;
    case "error":
      if (payload === undefined) {
        target.error(prefix);
      } else {
        target.error(prefix, payload);
      }
      break;
  }
}

export function logDebug(scope: string, msg: string, data?: unknown) {
  emit("debug", scope, msg, data);
}
export function logInfo(scope: string, msg: string, data?: unknown) {
  emit("info", scope, msg, data);
}
export function logWarn(scope: string, msg: string, data?: unknown) {
  emit("warn", scope, msg, data);
}
export function logError(scope: string, msg: string, data?: unknown) {
  emit("error", scope, msg, data);
}
