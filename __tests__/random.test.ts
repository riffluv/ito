import {
  generateDeterministicNumbers,
  hashString,
  mulberry32,
} from "../lib/game/random";

test("generateDeterministicNumbers unique and deterministic", () => {
  const a = generateDeterministicNumbers(5, 1, 100, "seed-1");
  const b = generateDeterministicNumbers(5, 1, 100, "seed-1");
  expect(a).toEqual(b);
  // uniqueness
  const set = new Set(a);
  expect(set.size).toBe(a.length);
  // within range
  expect(a.every((n) => n >= 1 && n <= 100)).toBe(true);
});

test("hashString is deterministic and stable for known inputs", () => {
  expect(hashString("seed-1")).toBe(3597787782);
  expect(hashString("seed-1")).toBe(hashString("seed-1"));
  expect(hashString("seed-2")).not.toBe(hashString("seed-1"));
});

test("mulberry32 produces a deterministic sequence in [0,1)", () => {
  const rnd = mulberry32(hashString("seed-1"));
  const first = rnd();
  const second = rnd();
  const third = rnd();
  expect(first).toBeGreaterThanOrEqual(0);
  expect(first).toBeLessThan(1);
  expect(second).toBeGreaterThanOrEqual(0);
  expect(second).toBeLessThan(1);
  expect(third).toBeGreaterThanOrEqual(0);
  expect(third).toBeLessThan(1);
  expect(first).toBeCloseTo(0.8126733123790473, 12);
  expect(second).toBeCloseTo(0.5248212472070009, 12);
  expect(third).toBeCloseTo(0.5631958588492125, 12);
});
