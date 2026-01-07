import { hasForceHold, type SafeUpdateContext, type SafeUpdateEvent } from "./safeUpdateModel";

export const safeUpdateGuards = {
  hasWaiting: ({ context }: { context: SafeUpdateContext }) =>
    Boolean(context.waitingRegistration?.waiting),
  clearResultActivated: ({ event }: { event: SafeUpdateEvent }) =>
    event.type === "WAITING_CLEARED" && event.result === "activated",
  clearResultRedundant: ({ event }: { event: SafeUpdateEvent }) =>
    event.type === "WAITING_CLEARED" && event.result === "redundant",
  isSuppressed: ({ context }: { context: SafeUpdateContext }) =>
    context.autoApplySuppressed || hasForceHold(context.autoApplyHolds),
} as const;

