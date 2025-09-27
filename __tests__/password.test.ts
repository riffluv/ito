import {
  PASSWORD_VERSION,
  createPasswordEntry,
  hashPassword,
  verifyPassword,
} from "@/lib/security/password";

describe("password security helpers", () => {
  const samplePassword = "correct horse battery staple";

  it("produces a deterministic hash for the same password and salt", async () => {
    const salt = "static-salt";
    const first = await hashPassword(samplePassword, salt);
    const second = await hashPassword(samplePassword, salt);

    expect(first).toBe(second);
    expect(typeof first).toBe("string");
    expect(first.length).toBeGreaterThan(0);
  });

  it("changes the hash when the salt changes", async () => {
    const saltA = "salt-one";
    const saltB = "salt-two";

    const hashA = await hashPassword(samplePassword, saltA);
    const hashB = await hashPassword(samplePassword, saltB);

    expect(hashA).not.toBe(hashB);
  });

  it("creates entries that verify successfully", async () => {
    const { hash, salt, version } = await createPasswordEntry(samplePassword);

    expect(version).toBe(PASSWORD_VERSION);
    expect(salt.length).toBeGreaterThanOrEqual(22);
    expect(hash.length).toBeGreaterThan(0);

    await expect(verifyPassword(samplePassword, salt, hash)).resolves.toBe(
      true
    );
  });

  it("rejects mismatching passwords", async () => {
    const salt = "shared-salt";
    const expected = await hashPassword(samplePassword, salt);

    await expect(
      verifyPassword("wrong password", salt, expected)
    ).resolves.toBe(false);
  });

  it("rejects when salt or hash is missing", async () => {
    await expect(verifyPassword(samplePassword, null, "hash")).resolves.toBe(
      false
    );
    await expect(verifyPassword(samplePassword, "salt", null)).resolves.toBe(
      false
    );
  });
});
