import { isUidMismatch } from "@/lib/server/roomCommandsLeaveRoom/helpers";

describe("roomCommandsLeaveRoom helpers", () => {
  test("isUidMismatch compares token uid and payload uid", () => {
    expect(isUidMismatch({ uidFromToken: "u1", uidFromPayload: "u1" })).toBe(false);
    expect(isUidMismatch({ uidFromToken: "u1", uidFromPayload: "u2" })).toBe(true);
  });
});

