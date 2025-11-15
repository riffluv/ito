import { waitForNextFrame } from "@/lib/utils/nextFrame";

describe("waitForNextFrame", () => {
  afterEach(() => {
    jest.useRealTimers();
    if (typeof window !== "undefined") {
      // @ts-expect-error resetting mock
      delete window.requestAnimationFrame;
      // @ts-expect-error resetting mock
      delete window.cancelAnimationFrame;
    }
  });

  it("resolves when requestAnimationFrame fires", async () => {
    jest.useFakeTimers();
    let captured: FrameRequestCallback | null = null;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      captured = cb;
      return 1;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = jest.fn();

    const promise = waitForNextFrame(10);
    expect(captured).toBeTruthy();
    captured?.(16);
    await promise;
  });

  it("falls back to timeout when RAF never fires", async () => {
    jest.useFakeTimers();
    window.requestAnimationFrame = (() => 1) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = jest.fn();

    const promise = waitForNextFrame(25);
    jest.advanceTimersByTime(25);
    await promise;
  });
});
