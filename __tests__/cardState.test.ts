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

  test("sort-submit: finished state forces all cards flipped regardless of revealIndex", () => {
    const s = computeCardState({
      ...base,
      player: {
        id: "p1",
        name: "A",
        avatar: "",
        number: 99,
        clue1: "zoo",
        ready: true,
        orderIndex: 0,
      },
      id: "p1",
      orderList: ["p1"],
      proposal: ["p1"],
      resolveMode: "sort-submit",
      roomStatus: "finished",
      idx: 0,
      revealIndex: 0, // hypothetically not advanced on this client before finalize
      revealAnimating: false,
    });
    expect(s.variant).toBe("flip");
    expect(s.flipped).toBe(true);
    expect(s.number).toBe(99);
  });
});
