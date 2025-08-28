import { submitSortedOrder } from "@/lib/game/room";
import { initializeApp, deleteApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, runTransaction } from "firebase/firestore";

// Mocking Firebase for testing
const testApp = initializeApp({ projectId: `test-project-${Math.random()}` });
const testDb = getFirestore(testApp);

// Connect to Firestore emulator for testing
if (!testDb._delegate._settings?.host?.includes("localhost")) {
  connectFirestoreEmulator(testDb, "localhost", 8080);
}

// Mock requireDb to return our test database
jest.mock("@/lib/firebase/require", () => ({
  requireDb: () => testDb,
}));

const roomId = "test-room-id";
const playersData = [
  { id: "p1", number: 10 },
  { id: "p2", number: 20 }, 
  { id: "p3", number: 30 },
];

async function setupRoom(roomOverrides = {}, playerOverrides = {}) {
  const roomRef = doc(testDb, "rooms", roomId);
  await setDoc(roomRef, {
    status: "clue",
    options: { resolveMode: "sort-submit" },
    order: { proposal: [] },
    ...roomOverrides,
  });

  for (const player of playersData) {
    const playerRef = doc(testDb, "rooms", roomId, "players", player.id);
    await setDoc(playerRef, {
      name: `Player${player.id}`,
      number: player.number,
      ...playerOverrides,
    });
  }
}

describe("submitSortedOrder", () => {
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
        for (const player of playersData) {
          const playerRef = doc(testDb, "rooms", roomId, "players", player.id);
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

  test("should successfully submit sorted order in ascending sequence", async () => {
    await setupRoom();
    const sortedList = ["p1", "p2", "p3"]; // 10, 20, 30 - ascending order

    await expect(submitSortedOrder(roomId, sortedList)).resolves.not.toThrow();

    // Verify the room was updated correctly
    const roomRef = doc(testDb, "rooms", roomId);
    const roomSnap = await runTransaction(testDb, async (tx) => {
      return await tx.get(roomRef);
    });
    
    const roomData = roomSnap.data();
    expect(roomData?.status).toBe("reveal");
    expect(roomData?.order?.list).toEqual(sortedList);
    expect(roomData?.order?.failed).toBe(false);
    expect(roomData?.result?.success).toBe(true);
  });

  test("should handle failure when order is not ascending", async () => {
    await setupRoom();
    const wrongOrder = ["p2", "p1", "p3"]; // 20, 10, 30 - not ascending

    await expect(submitSortedOrder(roomId, wrongOrder)).resolves.not.toThrow();

    const roomRef = doc(testDb, "rooms", roomId);
    const roomSnap = await runTransaction(testDb, async (tx) => {
      return await tx.get(roomRef);
    });

    const roomData = roomSnap.data();
    expect(roomData?.status).toBe("reveal");
    expect(roomData?.order?.failed).toBe(true);
    expect(roomData?.order?.failedAt).toBe(1); // Failed at index 1 (p1 with number 10)
    expect(roomData?.result?.success).toBe(false);
  });

  test("should throw error when room doesn't exist", async () => {
    const nonExistentRoomId = "non-existent-room";
    await expect(submitSortedOrder(nonExistentRoomId, ["p1"]))
      .rejects.toThrow("room not found");
  });

  test("should throw error when resolveMode is not sort-submit", async () => {
    await setupRoom({ options: { resolveMode: "sequential" } });
    
    await expect(submitSortedOrder(roomId, ["p1", "p2"]))
      .rejects.toThrow("このルームでは一括判定は無効です");
  });

  test("should throw error when room status is not clue", async () => {
    await setupRoom({ status: "waiting" });
    
    await expect(submitSortedOrder(roomId, ["p1", "p2"]))
      .rejects.toThrow("現在は提出できません");
  });

  test("should handle empty sorted order list", async () => {
    await setupRoom();
    
    await expect(submitSortedOrder(roomId, [])).resolves.not.toThrow();

    const roomRef = doc(testDb, "rooms", roomId);
    const roomSnap = await runTransaction(testDb, async (tx) => {
      return await tx.get(roomRef);
    });

    const roomData = roomSnap.data();
    expect(roomData?.status).toBe("reveal");
    expect(roomData?.order?.list).toEqual([]);
    expect(roomData?.order?.total).toBe(0);
  });

  test("should handle players with null/undefined numbers", async () => {
    await setupRoom({}, { number: null });
    
    // This should handle gracefully as evaluateSorted handles null/undefined numbers
    await expect(submitSortedOrder(roomId, ["p1", "p2"])).resolves.not.toThrow();
  });

  test("should set correct timestamps and metadata", async () => {
    await setupRoom();
    const sortedList = ["p1", "p2", "p3"];

    await submitSortedOrder(roomId, sortedList);

    const roomRef = doc(testDb, "rooms", roomId);
    const roomSnap = await runTransaction(testDb, async (tx) => {
      return await tx.get(roomRef);
    });

    const roomData = roomSnap.data();
    expect(roomData?.order?.decidedAt).toBeDefined();
    expect(roomData?.result?.revealedAt).toBeDefined();
    expect(roomData?.order?.total).toBe(3);
    expect(roomData?.order?.lastNumber).toBe(30); // Last number from p3
  });
});