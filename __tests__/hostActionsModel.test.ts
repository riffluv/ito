import { buildHostActionModel } from "@/lib/host/hostActionsModel";
import { topicTypeLabels } from "@/lib/topics";
import type { PlayerDoc, RoomDoc } from "@/lib/types";

function room(partial: Partial<RoomDoc>): RoomDoc {
  return {
    name: "r",
    hostId: "host",
    options: { allowContinueAfterFail: true, resolveMode: "sequential" },
    status: "waiting",
    topic: null,
    topicBox: null,
    order: null,
    result: null,
    deal: null,
    round: 0,
    ...partial,
  } as RoomDoc;
}

function players(n: number, assigned = 0): (PlayerDoc & { id: string })[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `u${i + 1}`,
    name: `p${i + 1}`,
    avatar: "a",
    number: i < assigned ? i + 1 : null,
    clue1: "",
    ready: false,
    orderIndex: 0,
  }));
}

describe("buildHostActionModel", () => {
  test("waiting with insufficient players → disabled quickStart", () => {
    const r = room({ status: "waiting" });
    const intents = buildHostActionModel(r, players(1), 1, topicTypeLabels, {
      label: "開始",
    });
    const qs = intents.find((i) => i.key === "quickStart")!;
    expect(qs.disabled).toBe(true);
    expect(qs.reason).toBe("2人必要: 現在1人");
  });

  test("sort-submit mode with partial cards → evaluate disabled with reason", () => {
    const r = room({
      status: "clue",
      topic: "食べ物",
      topicBox: "通常版",
      options: { allowContinueAfterFail: true, resolveMode: "sort-submit" },
      order: {
        list: [],
        proposal: ["u1"], // Only 1 out of 3 players
        decidedAt: undefined,
        failed: false,
        failedAt: null,
        lastNumber: null,
        total: null,
      },
    });
    const intents = buildHostActionModel(
      r,
      players(3, 3),
      3,
      topicTypeLabels,
      null
    );
    const evalIntent = intents.find((i) => i.key === "evaluate")!;
    expect(evalIntent.disabled).toBe(true);
    expect(evalIntent.reason).toBe("残り2人");
  });

  test("sort-submit mode with no cards → evaluate disabled with appropriate reason", () => {
    const r = room({
      status: "clue",
      topic: "食べ物",
      topicBox: "通常版",
      options: { allowContinueAfterFail: true, resolveMode: "sort-submit" },
      order: {
        list: [],
        proposal: [],
        decidedAt: undefined,
        failed: false,
        failedAt: null,
        lastNumber: null,
        total: null,
      },
    });
    const intents = buildHostActionModel(
      r,
      players(3, 3),
      3,
      topicTypeLabels,
      null
    );
    const evalIntent = intents.find((i) => i.key === "evaluate")!;
    expect(evalIntent.disabled).toBe(true);
    expect(evalIntent.reason).toBe("カードがまだ場に出ていません");
  });

  test("online count fallback behavior", () => {
    const r = room({ status: "waiting" });
    // undefined onlineCount should fallback to players.length
    const intents = buildHostActionModel(
      r,
      players(3),
      undefined,
      topicTypeLabels,
      {
        label: "開始",
      }
    );
    const qs = intents.find((i) => i.key === "quickStart")!;
    expect(qs.disabled).toBe(false); // 3 players >= 2
  });

  test("reveal status should not show any intents", () => {
    const r = room({ status: "reveal" });
    const intents = buildHostActionModel(
      r,
      players(3),
      3,
      topicTypeLabels,
      null
    );
    expect(intents.length).toBe(0);
  });
  test("waiting → quickStart + advancedMode", () => {
    const r = room({ status: "waiting" });
    const intents = buildHostActionModel(r, players(2), 2, topicTypeLabels, {
      label: "開始",
    });
    expect(intents.map((i) => i.key)).toEqual(["quickStart", "advancedMode"]);
    const qs = intents.find((i) => i.key === "quickStart")!;
    expect(qs.label).toBe("開始");
  });

  test("clue 未選択 → advancedMode + reset", () => {
    const r = room({ status: "clue", topic: null, topicBox: null });
    const intents = buildHostActionModel(
      r,
      players(2),
      2,
      topicTypeLabels,
      null
    );
    expect(intents.map((i) => i.key)).toEqual(["advancedMode", "reset"]);
    const reset = intents.find((i) => i.key === "reset")!;
    expect(reset.confirm).toBeDefined();
    expect(reset.confirm?.title).toContain("中断");
  });

  test("clue 選択済み・sequential → advancedのみ（簡素化後）", () => {
    const r = room({
      status: "clue",
      topic: "食べ物",
      topicBox: "通常版",
      options: { allowContinueAfterFail: true, resolveMode: "sort-submit" },
    });
    const intents = buildHostActionModel(
      r,
      players(3, 0),
      3,
      topicTypeLabels,
      null
    );
    expect(intents.map((i) => i.key)).toContain("advancedMode");
  });

  test("clue 選択済み・sort-submit → evaluateは条件満たすまで無効", () => {
    const r = room({
      status: "clue",
      topic: "食べ物",
      topicBox: "通常版",
      options: { allowContinueAfterFail: true, resolveMode: "sort-submit" },
      order: {
        list: [],
        proposal: [],
        decidedAt: undefined,
        failed: false,
        failedAt: null,
        lastNumber: null,
        total: null,
      },
    });
    const ps = players(3, 3);
    let intents = buildHostActionModel(r, ps, 3, topicTypeLabels, null);
    const eval1 = intents.find((i) => i.key === "evaluate")!;
    expect(eval1.disabled).toBe(true);
    const r2 = room({
      ...r,
      order: {
        list: [],
        proposal: ["u1", "u2", "u3"],
        decidedAt: undefined,
        failed: false,
        failedAt: null,
        lastNumber: null,
        total: null,
      } as any,
    });
    intents = buildHostActionModel(r2, ps, 3, topicTypeLabels, null);
    const eval2 = intents.find((i) => i.key === "evaluate")!;
    expect(eval2.disabled).toBeFalsy();
    expect(eval2.label).toBe("並びを確定");
  });

  test("finished → primary only (もう一度)", () => {
    const r = room({ status: "finished" });
    const intents = buildHostActionModel(r, players(2), 2, topicTypeLabels, {
      label: "もう一度",
    });
    expect(intents.map((i) => i.key)).toEqual(["primary"]);
    expect(intents[0].label).toBe("もう一度");
  });
});
