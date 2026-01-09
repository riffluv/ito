import {
  clearRoomPasswordHash,
  getCachedRoomPasswordHash,
  getRoomPasswordSessionKey,
  ROOM_PASSWORD_SESSION_PREFIX,
  storeRoomPasswordHash,
} from "@/lib/utils/roomPassword";

describe("roomPassword", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  test("getRoomPasswordSessionKey uses the expected prefix", () => {
    expect(ROOM_PASSWORD_SESSION_PREFIX).toBe("room-pass:");
    expect(getRoomPasswordSessionKey("room-1")).toBe("room-pass:room-1");
  });

  test("store/get/clear roundtrip in sessionStorage", () => {
    storeRoomPasswordHash("room-1", "hash-123");
    expect(getCachedRoomPasswordHash("room-1")).toBe("hash-123");

    clearRoomPasswordHash("room-1");
    expect(getCachedRoomPasswordHash("room-1")).toBeNull();
  });

  test("storeRoomPasswordHash ignores empty values", () => {
    storeRoomPasswordHash("room-1", "");
    storeRoomPasswordHash("room-1", null);
    storeRoomPasswordHash("room-1", undefined);
    expect(getCachedRoomPasswordHash("room-1")).toBeNull();
  });
});

