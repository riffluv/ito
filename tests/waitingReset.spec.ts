import { test, expect } from "@playwright/test";
import { composeWaitingResetPayload } from "../lib/server/roomActions";

test("composeWaitingResetPayload sets defaults", () => {
  const payload = composeWaitingResetPayload();
  expect(payload.status).toBe("waiting");
  expect(payload.result).toBeNull();
  expect(payload.deal).toBeNull();
  expect(payload.order).toBeNull();
  expect(payload["ui.recallOpen"]).toBe(true);
  expect(payload).not.toHaveProperty("round");
  expect(payload).not.toHaveProperty("topic");
});

test("composeWaitingResetPayload honors options", () => {
  const payload = composeWaitingResetPayload({
    recallOpen: false,
    resetRound: true,
    clearTopic: true,
    closedAt: "CLOSED",
    expiresAt: "EXPIRES",
  });
  expect(payload.status).toBe("waiting");
  expect(payload.round).toBe(0);
  expect(payload.topic).toBeNull();
  expect(payload.topicOptions).toBeNull();
  expect(payload.topicBox).toBeNull();
  expect(payload["ui.recallOpen"]).toBe(false);
  expect(payload.closedAt).toBe("CLOSED");
  expect(payload.expiresAt).toBe("EXPIRES");
});

test("composeWaitingResetPayload keeps recallOpen true when explicitly requested", () => {
  const payload = composeWaitingResetPayload({ recallOpen: true });
  expect(payload.status).toBe("waiting");
  expect(payload["ui.recallOpen"]).toBe(true);
  expect(payload).not.toHaveProperty("round");
  expect(payload).not.toHaveProperty("topic");
});
