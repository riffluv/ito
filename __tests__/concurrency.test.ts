import { applyPlay, defaultOrderState } from "../lib/game/rules";

test("concurrent plays: order-dependent results", () => {
  // Simulate two players playing at nearly the same time from same base order
  const base = defaultOrderState();
  // players and numbers
  const pA = { id: "a", num: 50 };
  const pB = { id: "b", num: 10 };

  // Scenario 1: a plays then b
  const afterA = applyPlay({
    order: base,
    playerId: pA.id,
    myNum: pA.num,
    allowContinue: true,
  }).next;
  const resB_afterA = applyPlay({
    order: afterA,
    playerId: pB.id,
    myNum: pB.num,
    allowContinue: true,
  });

  expect(resB_afterA.violation).toBe(true);
  expect(resB_afterA.next.failed).toBe(true);
  expect(resB_afterA.next.failedAt).toBe(2);

  // Scenario 2: b plays then a
  const afterB = applyPlay({
    order: base,
    playerId: pB.id,
    myNum: pB.num,
    allowContinue: true,
  }).next;
  const resA_afterB = applyPlay({
    order: afterB,
    playerId: pA.id,
    myNum: pA.num,
    allowContinue: true,
  });

  expect(resA_afterB.violation).toBe(false);
  expect(resA_afterB.next.failed).toBe(false);
  expect(resA_afterB.next.failedAt).toBeNull();
});
