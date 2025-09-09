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

  test("reveal: after 2nd card, if ascending so far, both first and second are green", () => {
    const players = [
      {
        id: "p1",
        name: "A",
        avatar: "",
        number: 10,
        clue1: "a",
        ready: true,
        orderIndex: 0,
      },
      {
        id: "p2",
        name: "B",
        avatar: "",
        number: 20,
        clue1: "b",
        ready: true,
        orderIndex: 1,
      },
      {
        id: "p3",
        name: "C",
        avatar: "",
        number: 5,
        clue1: "c",
        ready: true,
        orderIndex: 2,
      },
      {
        id: "p4",
        name: "D",
        avatar: "",
        number: 30,
        clue1: "d",
        ready: true,
        orderIndex: 3,
      },
    ];
    const orderList = ["p1", "p2", "p3", "p4"]; // 提出順

    // 2枚めくり終わり時点（まだ最終成功は確定していない）
    const realtimeResult = {
      success: true,
      failedAt: null as number | null,
      currentIndex: 2,
    };

    const s1 = computeCardState({
      ...base,
      player: players[0] as any,
      id: "p1",
      idx: 0,
      orderList,
      pending: [],
      proposal: orderList,
      resolveMode: "sort-submit",
      roomStatus: "reveal",
      revealAnimating: true,
      revealIndex: 2,
      realtimeResult,
    });
    const s2 = computeCardState({
      ...base,
      player: players[1] as any,
      id: "p2",
      idx: 1,
      orderList,
      pending: [],
      proposal: orderList,
      resolveMode: "sort-submit",
      roomStatus: "reveal",
      revealAnimating: true,
      revealIndex: 2,
      realtimeResult,
    });

    expect(s1.state).toBe("success");
    expect(s2.state).toBe("success");
  });

  test("reveal: on failure at 3rd card, first to third are red (cumulative fail)", () => {
    const players = [
      {
        id: "p1",
        name: "A",
        avatar: "",
        number: 10,
        clue1: "a",
        ready: true,
        orderIndex: 0,
      },
      {
        id: "p2",
        name: "B",
        avatar: "",
        number: 20,
        clue1: "b",
        ready: true,
        orderIndex: 1,
      },
      {
        id: "p3",
        name: "C",
        avatar: "",
        number: 5,
        clue1: "c",
        ready: true,
        orderIndex: 2,
      },
      {
        id: "p4",
        name: "D",
        avatar: "",
        number: 30,
        clue1: "d",
        ready: true,
        orderIndex: 3,
      },
    ];
    const orderList = ["p1", "p2", "p3", "p4"]; // 提出順

    const realtimeResult = { success: false, failedAt: 3, currentIndex: 3 };

    const s1 = computeCardState({
      ...base,
      player: players[0] as any,
      id: "p1",
      idx: 0,
      orderList,
      pending: [],
      proposal: orderList,
      resolveMode: "sort-submit",
      roomStatus: "reveal",
      revealAnimating: true,
      revealIndex: 3,
      realtimeResult,
    });
    const s2 = computeCardState({
      ...base,
      player: players[1] as any,
      id: "p2",
      idx: 1,
      orderList,
      pending: [],
      proposal: orderList,
      resolveMode: "sort-submit",
      roomStatus: "reveal",
      revealAnimating: true,
      revealIndex: 3,
      realtimeResult,
    });
    const s3 = computeCardState({
      ...base,
      player: players[2] as any,
      id: "p3",
      idx: 2,
      orderList,
      pending: [],
      proposal: orderList,
      resolveMode: "sort-submit",
      roomStatus: "reveal",
      revealAnimating: true,
      revealIndex: 3,
      realtimeResult,
    });

    expect(s1.state).toBe("fail");
    expect(s2.state).toBe("fail");
    expect(s3.state).toBe("fail");
  });
});
