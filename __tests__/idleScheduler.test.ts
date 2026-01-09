import { scheduleIdleTask } from "@/lib/utils/idleScheduler";

describe("scheduleIdleTask", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
    delete (window as unknown as { cancelIdleCallback?: unknown }).cancelIdleCallback;
  });

  test("uses requestIdleCallback when available and can be cancelled", async () => {
    const task = jest.fn();
    const cancelIdleCallback = jest.fn();

    (window as unknown as {
      requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback: (handle: number) => void;
    }).requestIdleCallback = (cb) => {
      window.setTimeout(cb, 0);
      return 123;
    };
    (window as unknown as { cancelIdleCallback: (handle: number) => void }).cancelIdleCallback =
      cancelIdleCallback;

    const cancel = scheduleIdleTask(task, { timeoutMs: 10 });
    cancel();

    await jest.runAllTimersAsync();
    expect(task).not.toHaveBeenCalled();
    expect(cancelIdleCallback).toHaveBeenCalledWith(123);
  });

  test("falls back to setTimeout when requestIdleCallback is missing and can be cancelled", async () => {
    const task = jest.fn();
    const cancel = scheduleIdleTask(task, { delayMs: 50 });
    await jest.advanceTimersByTimeAsync(10);
    cancel();
    await jest.runAllTimersAsync();
    expect(task).not.toHaveBeenCalled();
  });

  test("runs the task when not cancelled (setTimeout path)", async () => {
    const task = jest.fn();
    scheduleIdleTask(task, { delayMs: 20 });
    await jest.advanceTimersByTimeAsync(25);
    expect(task).toHaveBeenCalledTimes(1);
  });
});

