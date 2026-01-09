export type TimerRef = { current: number | null };

export function clearTimerRef(timerRef: TimerRef): void {
  if (typeof window === "undefined") return;
  if (timerRef.current === null) return;
  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}
