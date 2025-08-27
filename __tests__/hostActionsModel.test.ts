import { buildHostActionModel } from "@/lib/host/hostActionsModel";
import { topicTypeLabels } from "@/lib/topics";
import type { RoomDoc, PlayerDoc } from "@/lib/types";

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
  test("waiting → primary only (開始)", () => {
    const r = room({ status: "waiting" });
    const intents = buildHostActionModel(r, players(2), 2, topicTypeLabels, { label: "開始" });
    expect(intents.map((i) => i.key)).toEqual(["primary"]);
    expect(intents[0].label).toBe("開始");
  });

  test("clue 未選択 → カテゴリ3択", () => {
    const r = room({ status: "clue", topic: null, topicBox: null });
    const intents = buildHostActionModel(r, players(2), 2, topicTypeLabels, null);
    expect(intents).toHaveLength(3);
    // すべて pickTopic
    intents.forEach((i) => expect(i.key).toBe("pickTopic"));
    expect(intents.map((i) => i.label)).toEqual(Array.from(topicTypeLabels));
  });

  test("clue 選択済み・sequential → シャッフル/配布/選び直す（配布は2人未満で無効）", () => {
    const r = room({ status: "clue", topic: "食べ物", topicBox: "通常版", options: { allowContinueAfterFail: true, resolveMode: "sequential" } });
    const intents1 = buildHostActionModel(r, players(1, 0), 1, topicTypeLabels, null);
    expect(intents1.map((i) => i.key)).toEqual(["shuffle", "deal", "reselect"]);
    const deal1 = intents1.find((i) => i.key === "deal")!;
    expect(deal1.disabled).toBe(true);
    expect(deal1.reason).toMatch("2人以上");

    const intents2 = buildHostActionModel(r, players(3, 0), 3, topicTypeLabels, null);
    const deal2 = intents2.find((i) => i.key === "deal")!;
    expect(deal2.disabled).toBeFalsy();
  });

  test("clue 選択済み・sort-submit → evaluateは条件満たすまで無効", () => {
    const r = room({ status: "clue", topic: "食べ物", topicBox: "通常版", options: { allowContinueAfterFail: true, resolveMode: "sort-submit" }, order: { list: [], proposal: [], decidedAt: null, failed: false, failedAt: null, lastNumber: null, total: null } });
    const ps = players(3, 3);
    // 提案0件 → evaluate disabled
    let intents = buildHostActionModel(r, ps, 3, topicTypeLabels, null);
    const eval1 = intents.find((i) => i.key === "evaluate")!;
    expect(eval1.disabled).toBe(true);

    // 提案数が一致 → evaluate enabled
    const r2 = room({ ...r, order: { list: [], proposal: ["u1", "u2", "u3"], decidedAt: null, failed: false, failedAt: null, lastNumber: null, total: null } as any });
    intents = buildHostActionModel(r2, ps, 3, topicTypeLabels, null);
    const eval2 = intents.find((i) => i.key === "evaluate")!;
    expect(eval2.disabled).toBeFalsy();
  });

  test("finished → primary only (もう一度)", () => {
    const r = room({ status: "finished" });
    const intents = buildHostActionModel(r, players(2), 2, topicTypeLabels, { label: "もう一度" });
    expect(intents.map((i) => i.key)).toEqual(["primary"]);
    expect(intents[0].label).toBe("もう一度");
  });
});

