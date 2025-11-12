import { createBackgroundHoldController } from "@/lib/pixi/backgroundHold";

describe("createBackgroundHoldController", () => {
  it("no-ops when acquire is undefined", () => {
    const controller = createBackgroundHoldController(undefined);
    expect(() => controller.release()).not.toThrow();
  });

  it("releases at most once even if called repeatedly", () => {
    const release = jest.fn();
    const controller = createBackgroundHoldController(() => release);
    controller.release();
    controller.release();
    controller.release();
    expect(release).toHaveBeenCalledTimes(1);
  });
});
