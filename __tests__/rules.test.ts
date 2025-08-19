import { applyPlay, defaultOrderState } from "../lib/game/rules";

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
