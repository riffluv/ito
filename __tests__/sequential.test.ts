import { commitPlayFromClue } from "@/lib/game/room";
import { applyPlay, shouldFinishAfterPlay } from "@/lib/game/rules";
import { deleteApp, initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  runTransaction,
  setDoc,
} from "firebase/firestore";

// Mocking Firebase for testing
const projectId = `test-project-seq-${Date.now()}-${Math.random()}`;
const testApp = initializeApp({ projectId }, `test-app-seq-${Date.now()}`);
const testDb = getFirestore(testApp);

// Connect to Firestore emulator for testing
try {
  connectFirestoreEmulator(testDb, "localhost", 8080);
} catch (error) {
  // Emulator already connected
}

// Mock the database module
jest.mock("@/lib/firebase/client", () => ({
  db: testDb,
}));

// Mock presence functions - create mock implementation
const mockPresenceSupported = jest.fn(() => false);
const mockFetchPresenceUids = jest.fn(() => Promise.resolve([]));

jest.mock(
  "@/lib/presence/client",
  () => ({
    presenceSupported: mockPresenceSupported,
    fetchPresenceUids: mockFetchPresenceUids,
  }),
  { virtual: true }
);

const roomId = "test-room-sequential";

interface TestPlayer {
  id: string;
  number: number | null;
}

interface RoomOverrides {
  [key: string]: any;
}

async function setupSequentialRoom(
  roomOverrides: RoomOverrides = {},
  playersData: TestPlayer[] = []
) {
  const roomRef = doc(testDb, "rooms", roomId);
  await setDoc(roomRef, {
    status: "clue",
    options: {
      resolveMode: "sequential",
      allowContinueAfterFail: false,
    },
    order: {
      list: [],
      lastNumber: null,
      failed: false,
      failedAt: null,
      total: undefined,
    },
    ...roomOverrides,
  });

  for (const player of playersData) {
    const playerRef = doc(testDb, "rooms", roomId, "players", player.id);
    await setDoc(playerRef, {
      name: `Player${player.id}`,
      number: player.number,
    });
  }
}

describe("Sequential Game Logic", () => {
  afterAll(async () => {
    await deleteApp(testApp);
  });

  beforeEach(async () => {
    // Clean up room data before each test
    try {
      const roomRef = doc(testDb, "rooms", roomId);
      await runTransaction(testDb, async (tx) => {
        const roomSnap = await tx.get(roomRef);
        if (roomSnap.exists()) {
          tx.delete(roomRef);
        }
        // Delete players subcollection
        const players = ["p1", "p2", "p3"];
        for (const playerId of players) {
          const playerRef = doc(testDb, "rooms", roomId, "players", playerId);
          const playerSnap = await tx.get(playerRef);
          if (playerSnap.exists()) {
            tx.delete(playerRef);
          }
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("applyPlay", () => {
    test("should correctly handle first card play", () => {
      const order = {
        list: [],
        lastNumber: null,
        failed: false,
        failedAt: null,
        decidedAt: null as any,
        total: undefined,
      };

      const result = applyPlay({
        order,
        playerId: "p1",
        myNum: 25,
        allowContinue: false,
      });

      expect(result.next.list).toEqual(["p1"]);
      expect(result.next.lastNumber).toBe(25);
      expect(result.next.failed).toBe(false);
      expect(result.next.failedAt).toBeNull();
    });

    test("should handle successful ascending sequence", () => {
      const order = {
        list: ["p1"],
        lastNumber: 15,
        failed: false,
        failedAt: null,
        decidedAt: null as any,
        total: undefined,
      };

      const result = applyPlay({
        order,
        playerId: "p2",
        myNum: 25,
        allowContinue: false,
      });

      expect(result.next.list).toEqual(["p1", "p2"]);
      expect(result.next.lastNumber).toBe(25);
      expect(result.next.failed).toBe(false);
    });

    test("should handle failure when number is lower than last", () => {
      const order = {
        list: ["p1"],
        lastNumber: 25,
        failed: false,
        failedAt: null,
        decidedAt: null as any,
        total: undefined,
      };

      const result = applyPlay({
        order,
        playerId: "p2",
        myNum: 15, // Lower than 25, should fail
        allowContinue: false,
      });

      expect(result.next.list).toEqual(["p1", "p2"]);
      expect(result.next.lastNumber).toBe(15);
      expect(result.next.failed).toBe(true);
      expect(result.next.failedAt).toBe(1); // Failed at index 1
    });

    test("should allow equal numbers (non-strict ascending)", () => {
      const order = {
        list: ["p1"],
        lastNumber: 20,
        failed: false,
        failedAt: null,
        decidedAt: null as any,
        total: undefined,
      };

      const result = applyPlay({
        order,
        playerId: "p2",
        myNum: 20, // Equal to last number
        allowContinue: false,
      });

      expect(result.next.list).toEqual(["p1", "p2"]);
      expect(result.next.failed).toBe(false);
      expect(result.next.lastNumber).toBe(20);
    });

    test("should handle allowContinue after failure", () => {
      const order = {
        list: ["p1", "p2"],
        lastNumber: 15,
        failed: true,
        failedAt: 1,
        decidedAt: null as any,
        total: undefined,
      };

      const result = applyPlay({
        order,
        playerId: "p3",
        myNum: 30,
        allowContinue: true, // Allow continuing after failure
      });

      expect(result.next.list).toEqual(["p1", "p2", "p3"]);
      expect(result.next.lastNumber).toBe(30);
      expect(result.next.failed).toBe(true); // Still failed from previous
      expect(result.next.failedAt).toBe(1); // Original failure point
    });
  });

  describe("shouldFinishAfterPlay", () => {
    test("should finish when all expected players have played successfully", () => {
      const shouldFinish = shouldFinishAfterPlay({
        nextListLength: 3,
        total: 3,
        presenceCount: null,
        nextFailed: false,
        allowContinue: false,
      });

      expect(shouldFinish).toBe(true);
    });

    test("should finish when failed and allowContinue is false", () => {
      const shouldFinish = shouldFinishAfterPlay({
        nextListLength: 2,
        total: 3,
        presenceCount: null,
        nextFailed: true,
        allowContinue: false,
      });

      expect(shouldFinish).toBe(true);
    });

    test("should not finish when failed but allowContinue is true", () => {
      const shouldFinish = shouldFinishAfterPlay({
        nextListLength: 2,
        total: 3,
        presenceCount: null,
        nextFailed: true,
        allowContinue: true,
      });

      expect(shouldFinish).toBe(false);
    });

    test("should not finish when not all players have played yet", () => {
      const shouldFinish = shouldFinishAfterPlay({
        nextListLength: 2,
        total: 3,
        presenceCount: null,
        nextFailed: false,
        allowContinue: false,
      });

      expect(shouldFinish).toBe(false);
    });

    test("should use presenceCount when total is null", () => {
      const shouldFinish = shouldFinishAfterPlay({
        nextListLength: 3,
        total: undefined,
        presenceCount: 3,
        nextFailed: false,
        allowContinue: false,
      });

      expect(shouldFinish).toBe(true);
    });
  });

  describe("commitPlayFromClue integration", () => {
    test("should successfully handle first player move", async () => {
      const playersData = [
        { id: "p1", number: 15 },
        { id: "p2", number: 25 },
        { id: "p3", number: 35 },
      ];

      await setupSequentialRoom({}, playersData);

      await expect(commitPlayFromClue(roomId, "p1")).resolves.not.toThrow();

      // Verify room state
      const roomRef = doc(testDb, "rooms", roomId);
      const roomSnap = await runTransaction(testDb, async (tx) => {
        return await tx.get(roomRef);
      });

      const roomData = roomSnap.data();
      expect(roomData?.order?.list).toEqual(["p1"]);
      expect(roomData?.order?.lastNumber).toBe(15);
      expect(roomData?.order?.failed).toBe(false);
      expect(roomData?.status).toBe("clue"); // Should not finish yet
    });

    test("should handle game completion with success", async () => {
      const playersData = [
        { id: "p1", number: 15 },
        { id: "p2", number: 25 },
      ];

      await setupSequentialRoom(
        {
          order: {
            list: ["p1"],
            lastNumber: 15,
            failed: false,
            failedAt: null,
            total: 2, // Set total to 2 for completion
          },
        },
        playersData
      );

      await commitPlayFromClue(roomId, "p2");

      const roomRef = doc(testDb, "rooms", roomId);
      const roomSnap = await runTransaction(testDb, async (tx) => {
        return await tx.get(roomRef);
      });

      const roomData = roomSnap.data();
      // Sequential success now enters intermediate 'reveal' phase; UI will later finalize to 'finished'
      expect(roomData?.status).toBe("reveal");
      expect(roomData?.result?.success).toBe(true);
      expect(roomData?.order?.list).toEqual(["p1", "p2"]);
    });

    test("should handle game failure", async () => {
      const playersData = [
        { id: "p1", number: 25 },
        { id: "p2", number: 15 }, // Lower number - will cause failure
      ];

      await setupSequentialRoom(
        {
          order: {
            list: ["p1"],
            lastNumber: 25,
            failed: false,
            failedAt: null,
            total: 2,
          },
        },
        playersData
      );

      await commitPlayFromClue(roomId, "p2");

      const roomRef = doc(testDb, "rooms", roomId);
      const roomSnap = await runTransaction(testDb, async (tx) => {
        return await tx.get(roomRef);
      });

      const roomData = roomSnap.data();
      expect(roomData?.status).toBe("finished");
      expect(roomData?.result?.success).toBe(false);
      expect(roomData?.order?.failed).toBe(true);
      expect(roomData?.order?.failedAt).toBe(1);
    });

    test("should prevent double play from same player", async () => {
      const playersData = [{ id: "p1", number: 15 }];

      await setupSequentialRoom(
        {
          order: {
            list: ["p1"], // p1 already played
            lastNumber: 15,
            failed: false,
            failedAt: null,
            total: undefined,
          },
        },
        playersData
      );

      // This should not throw but also not change the state
      await expect(commitPlayFromClue(roomId, "p1")).resolves.not.toThrow();

      const roomRef = doc(testDb, "rooms", roomId);
      const roomSnap = await runTransaction(testDb, async (tx) => {
        return await tx.get(roomRef);
      });

      const roomData = roomSnap.data();
      expect(roomData?.order?.list).toEqual(["p1"]); // Should remain unchanged
    });

    test("should throw when player number is not set", async () => {
      const playersData = [{ id: "p1", number: null }]; // null number

      await setupSequentialRoom({}, playersData);

      await expect(commitPlayFromClue(roomId, "p1")).rejects.toThrow(
        "number not set"
      );
    });

    test("should throw when room status is not clue or playing", async () => {
      const playersData = [{ id: "p1", number: 15 }];

      await setupSequentialRoom({ status: "waiting" }, playersData);

      // Transaction should return early without throwing
      await expect(commitPlayFromClue(roomId, "p1")).resolves.not.toThrow();

      // Verify nothing changed
      const roomRef = doc(testDb, "rooms", roomId);
      const roomSnap = await runTransaction(testDb, async (tx) => {
        return await tx.get(roomRef);
      });

      const roomData = roomSnap.data();
      expect(roomData?.order?.list).toEqual([]);
    });
  });
});
