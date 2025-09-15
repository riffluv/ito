import { evaluateSorted } from "@/lib/game/rules";

// 簡易シード付きPRNG（テスト安定化）
function rng(seed: number) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff;
}

function genInt(r: () => number, min: number, max: number) {
  return Math.floor(r() * (max - min + 1)) + min;
}

describe("evaluateSorted property-based checks", () => {
  test("non-decreasing sequences are success", () => {
    const rand = rng(1234);
    for (let t = 0; t < 200; t++) {
      const n = genInt(rand, 1, 12);
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const nums: Record<string, number> = {} as any;
      let cur = genInt(rand, 0, 3);
      for (let i = 0; i < n; i++) {
        cur += genInt(rand, 0, 3); // 非減少（同値OK）
        nums[ids[i]] = cur;
      }
      const res = evaluateSorted(ids, nums);
      expect(res.success).toBe(true);
      expect(res.failedAt).toBeNull();
    }
  });

  test("a single decrease triggers failure at that position (1-based)", () => {
    const rand = rng(4321);
    for (let t = 0; t < 200; t++) {
      const n = genInt(rand, 3, 12);
      const ids = Array.from({ length: n }, (_, i) => `q${i}`);
      const nums: Record<string, number> = {} as any;
      // まず非減少で構築
      let cur = genInt(rand, 5, 8);
      for (let i = 0; i < n; i++) {
        cur += genInt(rand, 0, 5);
        nums[ids[i]] = cur;
      }
      // ランダムな位置kで降順を作る（k>=1）
      const k = genInt(rand, 1, n - 1); // 1..n-1 の位置で破壊
      nums[ids[k]] = nums[ids[k - 1]] - 1; // 降順
      const res = evaluateSorted(ids, nums);
      expect(res.success).toBe(false);
      expect(res.failedAt).toBe(k + 1); // 1-based index
    }
  });
});

