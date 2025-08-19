import { generateDeterministicNumbers } from "../lib/game/random";

test("generateDeterministicNumbers unique and deterministic", () => {
  const a = generateDeterministicNumbers(5, 1, 100, "seed-1");
  const b = generateDeterministicNumbers(5, 1, 100, "seed-1");
  expect(a).toEqual(b);
  // uniqueness
  const set = new Set(a);
  expect(set.size).toBe(a.length);
});
