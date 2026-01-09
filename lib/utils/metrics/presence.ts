import { bumpMetric, setMetric } from "./core";

const PRESENCE_SCOPE = "presence";

export function incrementPresenceMetric(key: string, delta = 1): void {
  bumpMetric(PRESENCE_SCOPE, key, delta);
}

export function setPresenceMetric(
  key: string,
  value: number | string | null | undefined
): void {
  setMetric(PRESENCE_SCOPE, key, value);
}

