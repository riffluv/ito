import {
  postRoundPrepare,
  postRoundReset,
  subscribeRoundEvents,
  subscribeRoundPrepare,
} from "@/lib/utils/broadcast";

type MockBroadcastMessageHandler = (event: { data: unknown }) => void;

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];

  name: string;
  posted: unknown[] = [];
  closed = false;
  listeners = new Map<string, Set<MockBroadcastMessageHandler>>();

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  postMessage(data: unknown) {
    this.posted.push(data);
  }

  close() {
    this.closed = true;
  }

  addEventListener(event: "message", handler: MockBroadcastMessageHandler) {
    const set = this.listeners.get(event) ?? new Set<MockBroadcastMessageHandler>();
    set.add(handler);
    this.listeners.set(event, set);
  }

  removeEventListener(event: "message", handler: MockBroadcastMessageHandler) {
    this.listeners.get(event)?.delete(handler);
  }

  emitMessage(data: unknown) {
    const handlers = this.listeners.get("message");
    if (!handlers) return;
    handlers.forEach((handler) => handler({ data }));
  }
}

describe("broadcast", () => {
  const originalBroadcastChannel = (globalThis as unknown as { BroadcastChannel?: unknown })
    .BroadcastChannel;

  beforeEach(() => {
    jest.useFakeTimers();
    MockBroadcastChannel.instances = [];
    (globalThis as unknown as { BroadcastChannel?: unknown }).BroadcastChannel =
      MockBroadcastChannel as unknown as typeof BroadcastChannel;
    window.localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    (globalThis as unknown as { BroadcastChannel?: unknown }).BroadcastChannel =
      originalBroadcastChannel;
  });

  test("postRoundReset posts to BroadcastChannel and localStorage, then cleans up storage key", async () => {
    postRoundReset("room-1");

    const ch = MockBroadcastChannel.instances[0];
    expect(ch?.name).toBe("ito-round-events");
    expect(ch?.posted[0]).toEqual(
      expect.objectContaining({ type: "ROUND_RESET", roomId: "room-1", at: expect.any(Number) })
    );
    expect(ch?.closed).toBe(true);

    const key = "ito:round:room-1:reset";
    expect(window.localStorage.getItem(key)).toBeTruthy();
    await jest.advanceTimersByTimeAsync(1000);
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  test("postRoundPrepare posts and writes prepare+prepareUntil keys", async () => {
    postRoundPrepare("room-2");

    const ch = MockBroadcastChannel.instances[0];
    expect(ch?.posted[0]).toEqual(
      expect.objectContaining({ type: "ROUND_PREPARE", roomId: "room-2", at: expect.any(Number) })
    );

    const key = "ito:round:room-2:prepare";
    const untilKey = "ito:round:room-2:prepareUntil";
    expect(window.localStorage.getItem(key)).toBeTruthy();
    expect(window.localStorage.getItem(untilKey)).toBeTruthy();
    await jest.advanceTimersByTimeAsync(1000);
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(window.localStorage.getItem(untilKey)).toBeTruthy();
  });

  test("subscribeRoundEvents receives both BroadcastChannel and storage events", () => {
    const onReset = jest.fn();
    const unsubscribe = subscribeRoundEvents("room-3", onReset);

    const ch = MockBroadcastChannel.instances[0];
    ch.emitMessage({ type: "ROUND_RESET", roomId: "room-3", at: 123 });
    expect(onReset).toHaveBeenCalledWith(123);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "ito:round:room-3:reset",
        newValue: "456",
      })
    );
    expect(onReset).toHaveBeenCalledWith(456);

    unsubscribe();
  });

  test("subscribeRoundPrepare receives both BroadcastChannel and storage events", () => {
    const onPrepare = jest.fn();
    const unsubscribe = subscribeRoundPrepare("room-4", onPrepare);

    const ch = MockBroadcastChannel.instances[0];
    ch.emitMessage({ type: "ROUND_PREPARE", roomId: "room-4", at: 777 });
    expect(onPrepare).toHaveBeenCalledWith(777);

    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "ito:round:room-4:prepare",
        newValue: "888",
      })
    );
    expect(onPrepare).toHaveBeenCalledWith(888);

    unsubscribe();
  });
});

