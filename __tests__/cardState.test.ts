import { computeCardState } from "@/lib/cards/logic";

const base = {
  pending: [] as string[],
  revealIndex: 0,
  revealAnimating: false,
  failed: false,
  failedAt: null as number | null,
  localFailedAt: null as number | null,
};

describe("computeCardState", () => {
  test("sort-submit: before reveal numbers hidden", () => {
    const s = computeCardState({
      ...base,
      player: {
        id: "p1",
        name: "A",
        avatar: "",
        number: 42,
        clue1: "apple",
        ready: true,
        orderIndex: 0,
      },
      id: "p1",
      orderList: ["p1"],
      proposal: ["p1"],
      resolveMode: "sort-submit",
      roomStatus: "clue",
      idx: 0,
    });
    expect(s.variant).toBe("flat");
    expect(s.number).toBeNull();
    expect(s.clueText).toBe("apple");
  });

  test("sort-submit: during reveal shows number when index < revealIndex", () => {
    const s = computeCardState({
      ...base,
      player: {
        id: "p1",
        name: "A",
        avatar: "",
        number: 7,
        clue1: "ant",
        ready: true,
        orderIndex: 0,
      },
      id: "p1",
      orderList: ["p1"],
      proposal: ["p1"],
      resolveMode: "sort-submit",
      roomStatus: "reveal",
      idx: 0,
      revealAnimating: true,
      revealIndex: 1,
    });
    expect(s.variant).toBe("flip");
    expect(s.flipped).toBe(true);
    expect(s.number).toBe(7);
  });

  test("sequential: flip enabled, first card not yet flipped (revealIndex=0)", () => {
    const s = computeCardState({
      ...base,
      player: {
        id: "p1",
        name: "A",
        avatar: "",
        number: 10,
        clue1: "cat",
        ready: true,
        orderIndex: 0,
      },
      id: "p1",
      orderList: ["p1"],
      resolveMode: "sequential",
      roomStatus: "clue",
      idx: 0,
      sequentialFlip: true,
    });
    expect(s.variant).toBe("flip");
    expect(s.flipped).toBe(false);
    // number hidden until revealIndex advances
    expect(s.number).toBeNull();
  });

  test("sequential: after revealIndex passes card index, number visible", () => {
    const s = computeCardState({
      ...base,
      player: {
        id: "p1",
        name: "A",
        avatar: "",
        number: 55,
        clue1: "desk",
        ready: true,
        orderIndex: 0,
      },
      id: "p1",
      orderList: ["p1"],
      resolveMode: "sequential",
      roomStatus: "clue",
      idx: 0,
      sequentialFlip: true,
      revealIndex: 1,
      revealAnimating: true,
    });
    expect(s.flipped).toBe(true);
    expect(s.number).toBe(55);
  });
});
