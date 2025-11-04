import { requestSeat } from "@/lib/game/service";

const mockDoc = jest.fn<any, any>();
const mockGetDoc = jest.fn<any, any>();
const mockSetDoc = jest.fn<any, any>();
const mockDeleteDoc = jest.fn<any, any>();
const mockServerTimestamp = jest.fn<any, any>(() => "SERVER_TIMESTAMP");

jest.mock("@/lib/firebase/client", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  updateDoc: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: (...args: any[]) => mockServerTimestamp(...args),
}));

jest.mock("@/lib/utils/trace", () => ({
  traceAction: jest.fn(),
  traceError: jest.fn(),
}));

jest.mock("@/lib/utils/metrics", () => ({
  bumpMetric: jest.fn(),
}));

describe("requestSeat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockServerTimestamp.mockReturnValue("SERVER_TIMESTAMP");
  });

  it("overwrites rejoin request document with allowed fields only", async () => {
    const roomRef = { id: "room-ref" };
    const requestRef = { id: "request-ref" };
    mockDoc.mockImplementationOnce(() => roomRef).mockImplementationOnce(() => requestRef);
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: "waiting",
        ui: { recallOpen: true },
      }),
    });
    mockSetDoc.mockResolvedValueOnce(undefined);
    mockDeleteDoc.mockResolvedValueOnce(undefined);

    await requestSeat("room-1", "user-1", "  Alice  ", "manual");

    expect(mockDoc).toHaveBeenNthCalledWith(1, {}, "rooms", "room-1");
    expect(mockDoc).toHaveBeenNthCalledWith(
      2,
      {},
      "rooms",
      "room-1",
      "rejoinRequests",
      "user-1"
    );
    expect(mockDeleteDoc).toHaveBeenCalledWith(requestRef);
    expect(mockSetDoc).toHaveBeenCalledWith(requestRef, {
      status: "pending",
      displayName: "Alice",
      source: "manual",
    });
    expect(mockSetDoc.mock.calls[0]).toHaveLength(2);
  });

  it("allows null displayName when trimmed value is empty", async () => {
    const roomRef = { id: "room-ref" };
    const requestRef = { id: "request-ref" };
    mockDoc.mockImplementationOnce(() => roomRef).mockImplementationOnce(() => requestRef);
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: "waiting",
        ui: { recallOpen: true },
      }),
    });
    mockSetDoc.mockResolvedValueOnce(undefined);
    mockDeleteDoc.mockResolvedValueOnce(undefined);

    await requestSeat("room-2", "user-2", "   ", "auto");

    expect(mockDeleteDoc).toHaveBeenCalledWith(requestRef);
    expect(mockSetDoc).toHaveBeenCalledWith(requestRef, {
      status: "pending",
      displayName: null,
      source: "auto",
    });
  });
});
