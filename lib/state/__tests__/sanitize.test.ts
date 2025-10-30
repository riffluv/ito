import { sanitizeRoom } from "../sanitize";

const baseRoom = {
  status: "waiting",
  hostId: "host",
  creatorId: "creator",
  options: { allowContinueAfterFail: true, resolveMode: "sort-submit" },
};

describe("sanitizeRoom", () => {
  it("preserves ui.recallOpen when boolean", () => {
    expect(sanitizeRoom({ ...baseRoom, ui: { recallOpen: true } }).ui?.recallOpen).toBe(true);
    expect(sanitizeRoom({ ...baseRoom, ui: { recallOpen: false } }).ui?.recallOpen).toBe(false);
  });

  it("drops invalid ui payloads", () => {
    expect(sanitizeRoom({ ...baseRoom, ui: { recallOpen: "yes" } }).ui).toBeUndefined();
    expect(sanitizeRoom({ ...baseRoom, ui: null }).ui).toBeUndefined();
    expect(sanitizeRoom({ ...baseRoom, ui: undefined }).ui).toBeUndefined();
  });
});
