import { applyDisplayModeToName, getDisplayMode, hasMinimalTag, stripMinimalTag } from "@/lib/game/displayMode";

describe("displayMode utils", () => {
  test("hasMinimalTag detects suffix with or without space", () => {
    expect(hasMinimalTag("部屋A[自分の手札]")).toBe(true);
    expect(hasMinimalTag("部屋A [自分の手札]")).toBe(true);
    expect(hasMinimalTag("部屋A")).toBe(false);
  });

  test("stripMinimalTag removes only trailing tag", () => {
    expect(stripMinimalTag("部屋A[自分の手札]")).toBe("部屋A");
    expect(stripMinimalTag("部屋A [自分の手札]")).toBe("部屋A");
    expect(stripMinimalTag("[自分の手札] 部屋A")).toBe("[自分の手札] 部屋A");
  });

  test("applyDisplayModeToName prevents duplicate tag", () => {
    expect(applyDisplayModeToName("部屋A", "minimal")).toBe("部屋A [自分の手札]");
    expect(applyDisplayModeToName("部屋A [自分の手札]", "minimal")).toBe("部屋A [自分の手札]");
    expect(applyDisplayModeToName("部屋A [自分の手札]", "full")).toBe("部屋A");
  });

  test("getDisplayMode prefers options.displayMode then falls back to name tag", () => {
    expect(getDisplayMode({ name: "部屋A", options: { displayMode: "minimal" } } as any)).toBe("minimal");
    expect(getDisplayMode({ name: "部屋A [自分の手札]", options: {} } as any)).toBe("minimal");
    expect(getDisplayMode({ name: "部屋A", options: {} } as any)).toBe("full");
  });
});

