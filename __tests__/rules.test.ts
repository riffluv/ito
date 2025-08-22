import { applyPlay, defaultOrderState, evaluateSorted } from "../lib/game/rules";

test("applyPlay ascending no violation", () => {
  const order = defaultOrderState();
  const r1 = applyPlay({
    order,
    playerId: "a",
    myNum: 10,
    allowContinue: false,
  });
  expect(r1.violation).toBe(false);
  const r2 = applyPlay({
    order: r1.next,
    playerId: "b",
    myNum: 20,
    allowContinue: false,
  });
  expect(r2.violation).toBe(false);
  const r3 = applyPlay({
    order: r2.next,
    playerId: "c",
    myNum: 30,
    allowContinue: false,
  });
  expect(r3.violation).toBe(false);
});

test("applyPlay violation detection", () => {
  let order = defaultOrderState();
  order = applyPlay({
    order,
    playerId: "a",
    myNum: 50,
    allowContinue: false,
  }).next;
  const res = applyPlay({
    order,
    playerId: "b",
    myNum: 10,
    allowContinue: false,
  });
  expect(res.violation).toBe(true);
  expect(res.next.failed).toBe(true);
});

test("evaluateSorted success and failure points", () => {
  const ids = ["a", "b", "c", "d"]
  const numsOk = { a: 1, b: 5, c: 9, d: 12 }
  const ok = evaluateSorted(ids, numsOk)
  expect(ok.success).toBe(true)
  expect(ok.failedAt).toBe(null)

  const numsNg = { a: 1, b: 10, c: 3, d: 12 }
  const ng = evaluateSorted(ids, numsNg)
  expect(ng.success).toBe(false)
  expect(ng.failedAt).toBe(3)
})
