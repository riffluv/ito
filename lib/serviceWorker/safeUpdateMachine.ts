import { setup } from "xstate";

import {
  createInitialContext,
  type SafeUpdateContext,
  type SafeUpdateEvent,
  type SafeUpdateMachineDeps,
} from "./safeUpdateModel";
export {
  buildTelemetryOptions,
  createInitialContext,
  getRequiredSwVersionHint,
  hasForceHold,
  normalizeHoldReason,
  setRequiredSwVersionHint,
} from "./safeUpdateModel";
export type {
  ApplyServiceWorkerOptions,
  ClearResult,
  SafeUpdateContext,
  SafeUpdateEvent,
  SafeUpdateMachineDeps,
  SafeUpdatePhase,
  SafeUpdateSnapshot,
  StartApplyFn,
} from "./safeUpdateModel";

import { createSafeUpdateActions } from "./safeUpdateMachineActions";
import { createSafeUpdateMachineConfig } from "./safeUpdateMachineConfig";
import { safeUpdateGuards } from "./safeUpdateMachineGuards";

export function createSafeUpdateMachine(deps: SafeUpdateMachineDeps) {
  const now = deps.now ?? (() => Date.now());
  const broadcast = deps.broadcast;
  const isBrowser = deps.isBrowser;
  const startApply = deps.startApply;

  const config = createSafeUpdateMachineConfig();
  return setup({
    types: {
      context: {} as SafeUpdateContext,
      events: {} as SafeUpdateEvent,
    },
    guards: safeUpdateGuards,
    actions: createSafeUpdateActions({ now, broadcast, isBrowser, startApply }),
  }).createMachine({
    ...config,
    context: createInitialContext(),
  });
}

