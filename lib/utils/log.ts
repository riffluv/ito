type Level = "silent" | "error" | "warn" | "info" | "debug";

function currentLevel(): Level {
  const v = (process.env.NEXT_PUBLIC_LOG_LEVEL || "info").toLowerCase();
  if (v === "silent" || v === "error" || v === "warn" || v === "info" || v === "debug") return v as Level;
  return "info";
}

function enabled(level: Level) {
  const order: Level[] = ["silent", "error", "warn", "info", "debug"];
  return order.indexOf(level) <= order.indexOf(currentLevel());
}

export function logDebug(scope: string, msg: string, data?: any) {
  if (enabled("debug")) console.debug(`[${scope}] ${msg}`, data ?? "");
}
export function logInfo(scope: string, msg: string, data?: any) {
  if (enabled("info")) console.info(`[${scope}] ${msg}`, data ?? "");
}
export function logWarn(scope: string, msg: string, data?: any) {
  if (enabled("warn")) console.warn(`[${scope}] ${msg}`, data ?? "");
}
export function logError(scope: string, msg: string, data?: any) {
  if (enabled("error")) console.error(`[${scope}] ${msg}`, data ?? "");
}

