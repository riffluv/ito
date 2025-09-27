import { Timestamp, serverTimestamp } from "firebase/firestore";

import { toMillis } from "@/lib/time";

describe("toMillis", () => {
  it("returns milliseconds for Firestore Timestamp", () => {
    const now = Timestamp.now();
    expect(toMillis(now)).toBe(now.toMillis());
  });

  it("handles Date instances", () => {
    const date = new Date("2024-01-02T03:04:05.678Z");
    expect(toMillis(date)).toBe(date.getTime());
  });

  it("handles numeric timestamps", () => {
    const ms = Date.now();
    expect(toMillis(ms)).toBe(ms);
  });

  it("returns 0 for FieldValue sentinels", () => {
    const sentinel = serverTimestamp();
    expect(toMillis(sentinel)).toBe(0);
  });
});
