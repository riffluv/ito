import { applyCheckoutFulfillment, markCheckoutSessionFailed } from "@/lib/server/stripeCheckout";

jest.mock("@/lib/server/firebaseAdmin", () => ({
  getAdminDb: jest.fn(),
}));

jest.mock("@/lib/stripe/client", () => ({
  getStripeClient: jest.fn(),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: jest.fn(() => "serverTimestamp"),
  },
  Timestamp: {
    fromDate: (date: Date) => ({ toMillis: () => date.getTime() }),
    fromMillis: (ms: number) => ({ toMillis: () => ms }),
    now: () => ({ toMillis: () => Date.now() }),
  },
}));

type Store = Map<string, Record<string, unknown>>;

class MockDocRef {
  constructor(private store: Store, public readonly id: string) {}

  get = async () => {
    const data = this.store.get(this.id);
    return {
      exists: data !== undefined,
      data: () => data,
    };
  };

  set = (data: Record<string, unknown>, options?: { merge?: boolean }) => {
    if (options?.merge && this.store.has(this.id)) {
      const prev = this.store.get(this.id) ?? {};
      this.store.set(this.id, { ...prev, ...data });
    } else {
      this.store.set(this.id, data);
    }
  };
}

const createMockDb = () => {
  const collections = new Map<string, Store>();
  const resolveStore = (name: string) => {
    if (!collections.has(name)) {
      collections.set(name, new Map());
    }
    return collections.get(name)!;
  };

  const db = {
    collection: (name: string) => ({
      doc: (id: string) => new MockDocRef(resolveStore(name), id),
    }),
    runTransaction: async (fn: (tx: any) => Promise<void>) => {
      await fn({
        get: (docRef: MockDocRef) => docRef.get(),
        set: (docRef: MockDocRef, data: Record<string, unknown>, options?: { merge?: boolean }) =>
          docRef.set(data, options),
      });
    },
  };

  return { db, collections };
};

const mockStripeRetrieve = (session: Record<string, any>) => {
  const { getStripeClient } = jest.requireMock("@/lib/stripe/client");
  getStripeClient.mockReturnValue({
    checkout: {
      sessions: {
        retrieve: jest.fn().mockResolvedValue(session),
      },
    },
  });
};

describe("stripeCheckout transactions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("records fulfillment when session is paid", async () => {
    const sessionId = "cs_test_paid";
    const fullSession = {
      id: sessionId,
      payment_status: "paid",
      status: "complete",
      amount_total: 1200,
      currency: "jpy",
      metadata: { userId: "user_123" },
      line_items: { data: [] },
      customer: "cus_test",
      client_reference_id: "client_ref",
    };

    mockStripeRetrieve(fullSession);

    const { db, collections } = createMockDb();
    const { getAdminDb } = jest.requireMock("@/lib/server/firebaseAdmin");
    getAdminDb.mockReturnValue(db);

    const eventSession = {
      id: sessionId,
      payment_status: "paid",
      status: "complete",
    } as any;

    await applyCheckoutFulfillment(eventSession, {
      id: "evt_1",
      type: "checkout.session.completed",
      created: Math.floor(Date.now() / 1000),
    });

    const sessionsStore = collections.get("stripe_checkout_sessions")!;
    const entitlementsStore = collections.get("stripe_checkout_entitlements")!;

    expect(sessionsStore.get(sessionId)).toMatchObject({
      fulfillment: expect.objectContaining({
        status: "fulfilled",
      }),
      paymentStatus: "paid",
      amountTotal: fullSession.amount_total,
    });

    expect(entitlementsStore.get(sessionId)).toMatchObject({
      status: "granted",
      amountTotal: fullSession.amount_total,
      beneficiary: expect.objectContaining({
        type: "userId",
        key: "user_123",
      }),
    });
  });

  it("marks fulfillment as failed when session expires", async () => {
    const sessionId = "cs_test_failed";
    const fullSession = {
      id: sessionId,
      payment_status: "unpaid",
      status: "expired",
      amount_total: 800,
      currency: "jpy",
      metadata: { userId: "user_456" },
      line_items: { data: [] },
    };

    mockStripeRetrieve(fullSession);

    const { db, collections } = createMockDb();
    const { getAdminDb } = jest.requireMock("@/lib/server/firebaseAdmin");
    getAdminDb.mockReturnValue(db);

    const eventSession = {
      id: sessionId,
      payment_status: "unpaid",
      status: "expired",
    } as any;

    await markCheckoutSessionFailed(eventSession, {
      id: "evt_failed",
      type: "checkout.session.expired",
      created: Math.floor(Date.now() / 1000),
    }, "expired");

    const sessionsStore = collections.get("stripe_checkout_sessions")!;

    expect(sessionsStore.get(sessionId)).toMatchObject({
      fulfillment: expect.objectContaining({ status: "failed" }),
      failure: expect.objectContaining({ reason: "expired" }),
    });
  });
});
