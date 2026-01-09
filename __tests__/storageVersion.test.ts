import { ensureStorageSchema } from "@/lib/utils/storageVersion";

describe("ensureStorageSchema", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("sets storage version if none exists, without clearing other keys", () => {
    window.localStorage.setItem("lastRoom", "ROOM123");
    ensureStorageSchema();

    expect(window.localStorage.getItem("ito:storage-version")).toBeTruthy();
    expect(window.localStorage.getItem("lastRoom")).toBe("ROOM123");
  });

  it("clears known keys and prefixes when version changes", () => {
    ensureStorageSchema();
    const currentVersion = window.localStorage.getItem("ito:storage-version");
    expect(currentVersion).toBeTruthy();

    window.localStorage.setItem("ito:storage-version", "v-old");
    window.localStorage.setItem("lastRoom", "ROOM123");
    window.localStorage.setItem("ito:round:abc", "1");
    window.localStorage.setItem("ito:sound:settings:v1", "x");
    window.localStorage.setItem("unrelated", "keep");

    ensureStorageSchema();

    expect(window.localStorage.getItem("ito:storage-version")).toBe(currentVersion);
    expect(window.localStorage.getItem("lastRoom")).toBeNull();
    expect(window.localStorage.getItem("ito:round:abc")).toBeNull();
    expect(window.localStorage.getItem("ito:sound:settings:v1")).toBeNull();
    expect(window.localStorage.getItem("unrelated")).toBe("keep");
  });

  it("does nothing when stored version matches current version", () => {
    ensureStorageSchema();
    const currentVersion = window.localStorage.getItem("ito:storage-version");
    expect(currentVersion).toBeTruthy();

    window.localStorage.setItem("ito:storage-version", currentVersion!);
    window.localStorage.setItem("lastRoom", "ROOM123");

    ensureStorageSchema();

    expect(window.localStorage.getItem("ito:storage-version")).toBe(currentVersion);
    expect(window.localStorage.getItem("lastRoom")).toBe("ROOM123");
  });
});
