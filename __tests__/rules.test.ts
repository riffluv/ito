import {
  applyPlay,
  defaultOrderState,
  evaluateSorted,
} from "../lib/game/rules";

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

test("applyPlay continues after failure when allowed", () => {
  let order = defaultOrderState();
  order = applyPlay({
    order,
    playerId: "p1",
    myNum: 1,
    allowContinue: true,
  }).next;
  order = applyPlay({
    order,
    playerId: "p2",
    myNum: 5,
    allowContinue: true,
  }).next;
  // p3 plays a lower number -> failure triggered
  const res = applyPlay({
    order,
    playerId: "p3",
    myNum: 3,
    allowContinue: true,
  });
  expect(res.violation).toBe(true);
  expect(res.next.failed).toBe(true);
  // After failure, another player can still play if allowContinue is true
  const after = applyPlay({
    order: res.next,
    playerId: "p4",
    myNum: 10,
    allowContinue: true,
  });
  expect(after.violation).toBe(false);
  expect(after.next.list).toEqual(["p1", "p2", "p3", "p4"]);
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
  const ids = ["a", "b", "c", "d"];
  const numsOk = { a: 1, b: 5, c: 9, d: 12 };
  const ok = evaluateSorted(ids, numsOk);
  expect(ok.success).toBe(true);
  expect(ok.failedAt).toBe(null);

  const numsNg = { a: 1, b: 10, c: 3, d: 12 };
  const ng = evaluateSorted(ids, numsNg);
  expect(ng.success).toBe(false);
  expect(ng.failedAt).toBe(3);
});

test("evaluateSorted empty list", () => {
  const res = evaluateSorted([], {} as any);
  expect(res.success).toBe(true);
  expect(res.failedAt).toBe(null);
});

test("evaluateSorted allows equal (non-strict ascending)", () => {
  const ids = ["p1", "p2", "p3"];
  const nums = { p1: 5, p2: 5, p3: 7 } as any;
  const res = evaluateSorted(ids, nums);
  expect(res.success).toBe(true);
  expect(res.failedAt).toBe(null);
});
