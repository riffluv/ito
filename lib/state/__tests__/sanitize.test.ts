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

  it("preserves roundPreparing and revealPending flags", () => {
    expect(sanitizeRoom({ ...baseRoom, ui: { roundPreparing: true } }).ui?.roundPreparing).toBe(true);
    expect(sanitizeRoom({ ...baseRoom, ui: { roundPreparing: false } }).ui?.roundPreparing).toBe(false);
    expect(sanitizeRoom({ ...baseRoom, ui: { revealPending: true } }).ui?.revealPending).toBe(true);
    expect(sanitizeRoom({ ...baseRoom, ui: { revealPending: false } }).ui?.revealPending).toBe(false);
  });

  it("preserves revealBeginAt markers when provided", () => {
    const marker = {} as never;
    expect(sanitizeRoom({ ...baseRoom, ui: { revealBeginAt: marker } }).ui?.revealBeginAt).toBe(
      marker
    );
    expect(sanitizeRoom({ ...baseRoom, ui: { revealBeginAt: null } }).ui?.revealBeginAt).toBeNull();
  });

  it("drops invalid ui payloads", () => {
    expect(sanitizeRoom({ ...baseRoom, ui: { recallOpen: "yes" } }).ui).toBeUndefined();
    expect(sanitizeRoom({ ...baseRoom, ui: { roundPreparing: "yes" } }).ui).toBeUndefined();
    expect(sanitizeRoom({ ...baseRoom, ui: { revealPending: "yes" } }).ui).toBeUndefined();
    expect(sanitizeRoom({ ...baseRoom, ui: null }).ui).toBeUndefined();
    expect(sanitizeRoom({ ...baseRoom, ui: undefined }).ui).toBeUndefined();
  });
});
