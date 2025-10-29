import { expect, test } from "@playwright/test";
import * as roomModule from "../lib/game/room";
import * as roomsModule from "../lib/firebase/rooms";
import {
  GameService,
  addCardToProposal,
  commitPlayFromClue,
  dealNumbers,
  removeCardFromProposal,
  resetRoomWithPrune,
  startGame,
  submitSortedOrder,
  topicControls,
} from "../lib/game/service";
import { topicControls as topicControlsOriginal } from "../lib/game/topicControls";

test.describe("GameService wrappers", () => {
  test("startGame は room.startGame へ委譲する", async () => {
    const calls: string[] = [];
    const original = roomModule.startGame;
    (roomModule as any).startGame = async (roomId: string) => {
      calls.push(roomId);
      return "delegated";
    };

    try {
      const result = await startGame("room-1");
      expect(result).toBe("delegated");
      expect(calls).toEqual(["room-1"]);
    } finally {
      (roomModule as any).startGame = original;
    }
  });

  test("dealNumbers は room.dealNumbers へ委譲する", async () => {
    const calls: string[] = [];
    const original = roomModule.dealNumbers;
    (roomModule as any).dealNumbers = async (roomId: string) => {
      calls.push(roomId);
      return 7;
    };

    try {
      const result = await dealNumbers("room-2");
      expect(result).toBe(7);
      expect(calls).toEqual(["room-2"]);
    } finally {
      (roomModule as any).dealNumbers = original;
    }
  });

  test("addCardToProposal と removeCardFromProposal は引数を透過する", async () => {
    const addCalls: Array<[string, string]> = [];
    const removeCalls: Array<[string, string]> = [];
    const originalAdd = roomModule.addCardToProposal;
    const originalRemove = roomModule.removeCardFromProposal;
    (roomModule as any).addCardToProposal = async (roomId: string, playerId: string) => {
      addCalls.push([roomId, playerId]);
      return undefined;
    };
    (roomModule as any).removeCardFromProposal = async (roomId: string, playerId: string) => {
      removeCalls.push([roomId, playerId]);
      return undefined;
    };

    try {
      await addCardToProposal("room-3", "player-1");
      await removeCardFromProposal("room-3", "player-1");
      expect(addCalls).toEqual([["room-3", "player-1"]]);
      expect(removeCalls).toEqual([["room-3", "player-1"]]);
    } finally {
      (roomModule as any).addCardToProposal = originalAdd;
      (roomModule as any).removeCardFromProposal = originalRemove;
    }
  });

  test("commitPlayFromClue の例外はそのまま伝播する", async () => {
    const original = roomModule.commitPlayFromClue;
    (roomModule as any).commitPlayFromClue = async () => {
      throw new Error("delegated-error");
    };

    try {
      await expect(
        commitPlayFromClue("room-4", "player-2")
      ).rejects.toThrow("delegated-error");
    } finally {
      (roomModule as any).commitPlayFromClue = original;
    }
  });

  test("submitSortedOrder は list をそのまま渡す", async () => {
    const calls: Array<[string, string[]]> = [];
    const original = roomModule.submitSortedOrder;
    (roomModule as any).submitSortedOrder = async (roomId: string, list: string[]) => {
      calls.push([roomId, list]);
      return undefined;
    };

    try {
      const payload = ["a", "b", "c"];
      await submitSortedOrder("room-5", payload);
      expect(calls).toEqual([["room-5", payload]]);
    } finally {
      (roomModule as any).submitSortedOrder = original;
    }
  });

  test("resetRoomWithPrune は firebase.rooms.resetRoomWithPrune へ委譲する", async () => {
    const calls: Array<[string, unknown, unknown]> = [];
    const original = roomsModule.resetRoomWithPrune;
    (roomsModule as any).resetRoomWithPrune = async (
      roomId: string,
      keepIds: string[] | null | undefined,
      opts?: { notifyChat?: boolean; recallSpectators?: boolean }
    ) => {
      calls.push([roomId, keepIds, opts]);
      return undefined;
    };

    try {
      await resetRoomWithPrune("room-6", ["keep-1"], { notifyChat: true });
      expect(calls).toEqual([["room-6", ["keep-1"], { notifyChat: true }]]);
    } finally {
      (roomsModule as any).resetRoomWithPrune = original;
    }
  });

  test("topicControls は元のオブジェクトを再エクスポートする", () => {
    expect(topicControls).toBe(topicControlsOriginal);
    expect(GameService.topicControls).toBe(topicControlsOriginal);
  });

  test("GameService 経由でも同じ委譲が行われる", async () => {
    const calls: string[] = [];
    const original = roomModule.startGame;
    (roomModule as any).startGame = async (roomId: string) => {
      calls.push(roomId);
      return undefined;
    };

    try {
      await GameService.startGame("room-7");
      expect(calls).toEqual(["room-7"]);
    } finally {
      (roomModule as any).startGame = original;
    }
  });
});
