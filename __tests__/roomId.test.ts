import { generateRoomId, isShortRoomId } from "@/lib/utils/roomId";

describe("roomId", () => {
  it("generateRoomId returns a 6-char id in the allowed alphabet", () => {
    const id = generateRoomId();
    expect(id).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(isShortRoomId(id)).toBe(true);
  });

  it("isShortRoomId rejects wrong length or invalid characters", () => {
    expect(isShortRoomId("")).toBe(false);
    expect(isShortRoomId("ABC")).toBe(false);
    expect(isShortRoomId("ABCDEFG")).toBe(false);
    expect(isShortRoomId("AAAAA0")).toBe(false); // 0 is excluded
    expect(isShortRoomId("AAAAA1")).toBe(false); // 1 is excluded
    expect(isShortRoomId("AAAAAI")).toBe(false); // I is excluded
    expect(isShortRoomId("AAAAAO")).toBe(false); // O is excluded
    expect(isShortRoomId("aaaaaa")).toBe(false); // lowercase is excluded
  });
});

