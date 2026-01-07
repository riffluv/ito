export function createSafeUpdateMachineConfig() {
  return {
    id: "safeUpdate",
    initial: "idle",
    on: {
      RELOAD_CONSUMED: { actions: "consumePendingReload" },
      PENDING_APPLY_CONSUMED: { actions: "consumePendingApply" },
    },
    states: {
      idle: {
        on: {
          CHECK_STARTED: { target: "checking", actions: "setCheckStart" },
          WAITING_DETECTED: {
            target: "update_detected",
            actions: ["storeWaiting", "announceWaiting", "queueEvaluateReady"],
          },
          AUTO_SUPPRESS: { actions: ["setAutoSuppressed", "announceSuppressed"] },
          AUTO_RESUME: { actions: ["clearAutoSuppressed", "announceResume"] },
          FORCE_HOLD: { actions: ["addForceHold", "announceForceHold"] },
          FORCE_RELEASE: { actions: ["releaseForceHold", "announceForceRelease"] },
        },
      },
      checking: {
        entry: "setCheckStart",
        on: {
          WAITING_DETECTED: {
            target: "update_detected",
            actions: ["storeWaiting", "announceWaiting", "queueEvaluateReady"],
          },
          CHECK_COMPLETED: [
            {
              guard: { type: "hasWaiting" },
              target: "update_detected",
              actions: "queueEvaluateReady",
            },
            { target: "idle" },
          ],
          CHECK_FAILED: { target: "idle", actions: "setCheckFailure" },
          AUTO_SUPPRESS: { actions: ["setAutoSuppressed", "announceSuppressed"] },
          AUTO_RESUME: { actions: ["clearAutoSuppressed", "announceResume"] },
          FORCE_HOLD: { actions: ["addForceHold", "announceForceHold"] },
          FORCE_RELEASE: { actions: ["releaseForceHold", "announceForceRelease"] },
        },
      },
      update_detected: {
        entry: "queueEvaluateReady",
        on: {
          READY_SUPPRESSED: { target: "suppressed" },
          READY_AUTO: { target: "auto_pending" },
          READY_MANUAL: { target: "waiting_user" },
          WAITING_DETECTED: {
            actions: [
              "storeWaiting",
              "announceWaiting",
              "queueEvaluateReady",
              "scheduleAutoApplyTimer",
            ],
          },
          WAITING_CLEARED: {
            target: "idle",
            actions: ["clearWaiting", "announceCleared", "clearAutoApplyTimer"],
          },
          APPLY_REQUEST: [
            {
              guard: { type: "hasWaiting" },
              target: "applying",
              actions: "startManualApplying",
            },
            { target: "failed", actions: "noWaitingFailure" },
          ],
          AUTO_SUPPRESS: {
            target: "suppressed",
            actions: ["setAutoSuppressed", "announceSuppressed"],
          },
          AUTO_RESUME: { actions: ["clearAutoSuppressed", "announceResume"] },
          FORCE_HOLD: {
            target: "suppressed",
            actions: ["addForceHold", "announceForceHold"],
          },
          FORCE_RELEASE: {
            actions: ["releaseForceHold", "announceForceRelease", "queueEvaluateReady"],
          },
        },
      },
      auto_pending: {
        entry: "scheduleAutoApplyTimer",
        on: {
          READY_SUPPRESSED: { target: "suppressed" },
          READY_MANUAL: { target: "waiting_user" },
          AUTO_TIMER_EXPIRED: [
            {
              guard: { type: "hasWaiting" },
              target: "applying",
              actions: "startAutoApplying",
            },
            { target: "failed", actions: "noWaitingFailure" },
          ],
          APPLY_REQUEST: [
            {
              guard: { type: "hasWaiting" },
              target: "applying",
              actions: "startManualApplying",
            },
            { target: "failed", actions: "noWaitingFailure" },
          ],
          AUTO_SUPPRESS: {
            target: "suppressed",
            actions: ["setAutoSuppressed", "announceSuppressed"],
          },
          AUTO_RESUME: { actions: ["clearAutoSuppressed", "announceResume"] },
          FORCE_HOLD: {
            target: "suppressed",
            actions: ["addForceHold", "announceForceHold"],
          },
          FORCE_RELEASE: {
            actions: ["releaseForceHold", "announceForceRelease", "queueEvaluateReady"],
          },
          WAITING_CLEARED: {
            target: "idle",
            actions: ["clearAutoApplyTimer", "clearWaiting", "announceCleared"],
          },
          WAITING_DETECTED: {
            target: "auto_pending",
            internal: false,
            actions: ["storeWaiting", "announceWaiting"],
          },
        },
      },
      waiting_user: {
        entry: "clearAutoApplyTimer",
        on: {
          APPLY_REQUEST: [
            {
              guard: { type: "hasWaiting" },
              target: "applying",
              actions: "startManualApplying",
            },
            { target: "failed", actions: "noWaitingFailure" },
          ],
          AUTO_SUPPRESS: {
            target: "suppressed",
            actions: ["setAutoSuppressed", "announceSuppressed"],
          },
          AUTO_RESUME: {
            actions: ["clearAutoSuppressed", "announceResume", "queueEvaluateReady"],
          },
          FORCE_HOLD: {
            target: "suppressed",
            actions: ["addForceHold", "announceForceHold"],
          },
          FORCE_RELEASE: {
            actions: ["releaseForceHold", "announceForceRelease", "queueEvaluateReady"],
          },
          WAITING_CLEARED: {
            target: "idle",
            actions: ["clearAutoApplyTimer", "clearWaiting", "announceCleared"],
          },
          WAITING_DETECTED: {
            target: "waiting_user",
            internal: false,
            actions: ["storeWaiting", "announceWaiting"],
          },
          READY_AUTO: { target: "auto_pending" },
          READY_SUPPRESSED: { target: "suppressed" },
        },
      },
      suppressed: {
        entry: "clearAutoApplyTimer",
        on: {
          APPLY_REQUEST: [
            {
              guard: { type: "hasWaiting" },
              target: "applying",
              actions: "startManualApplying",
            },
            { target: "failed", actions: "noWaitingFailure" },
          ],
          AUTO_RESUME: {
            actions: ["clearAutoSuppressed", "announceResume", "queueEvaluateReady"],
          },
          AUTO_SUPPRESS: { actions: "setAutoSuppressed" },
          FORCE_HOLD: { actions: ["addForceHold", "announceForceHold"] },
          FORCE_RELEASE: {
            actions: ["releaseForceHold", "announceForceRelease", "queueEvaluateReady"],
          },
          WAITING_CLEARED: {
            target: "idle",
            actions: ["clearAutoApplyTimer", "clearWaiting", "announceCleared"],
          },
          WAITING_DETECTED: {
            target: "suppressed",
            internal: false,
            actions: ["storeWaiting", "announceWaiting"],
          },
          READY_AUTO: { target: "auto_pending" },
          READY_MANUAL: { target: "waiting_user" },
          READY_SUPPRESSED: { target: "suppressed" },
        },
      },
      applying: {
        entry: ["clearAutoApplyTimer", "scheduleApplyTimeout"],
        exit: "clearApplyTimeout",
        on: {
          APPLY_SUCCESS: { target: "applied", actions: "handleApplySuccess" },
          APPLY_FAILURE: { target: "failed", actions: "handleApplyFailure" },
          APPLY_TIMEOUT: { target: "failed", actions: "handleApplyTimeout" },
          WAITING_CLEARED: [
            {
              guard: { type: "clearResultActivated" },
              target: "applied",
              actions: "handleApplySuccess",
            },
            {
              guard: { type: "clearResultRedundant" },
              target: "failed",
              actions: "handleApplyRedundant",
            },
            {
              target: "idle",
              actions: ["clearAutoApplyTimer", "clearWaiting", "announceCleared"],
            },
          ],
        },
      },
      applied: {
        entry: "resetRetry",
        on: {
          WAITING_DETECTED: {
            target: "update_detected",
            actions: ["storeWaiting", "announceWaiting", "queueEvaluateReady"],
          },
          WAITING_CLEARED: {
            target: "idle",
            actions: ["clearWaiting", "announceCleared"],
          },
          AUTO_SUPPRESS: { actions: ["setAutoSuppressed", "announceSuppressed"] },
          AUTO_RESUME: { actions: ["clearAutoSuppressed", "announceResume", "queueEvaluateReady"] },
          FORCE_HOLD: { actions: ["addForceHold", "announceForceHold"] },
          FORCE_RELEASE: { actions: ["releaseForceHold", "announceForceRelease", "queueEvaluateReady"] },
        },
      },
      failed: {
        entry: "incrementRetry",
        on: {
          RETRY: [
            {
              guard: { type: "hasWaiting" },
              target: "applying",
              actions: "startRetryApplying",
            },
            { target: "failed", actions: "noWaitingFailure" },
          ],
          WAITING_DETECTED: {
            target: "update_detected",
            actions: ["storeWaiting", "announceWaiting", "queueEvaluateReady"],
          },
          WAITING_CLEARED: {
            target: "idle",
            actions: ["clearWaiting", "announceCleared"],
          },
          AUTO_SUPPRESS: { actions: ["setAutoSuppressed", "announceSuppressed"] },
          AUTO_RESUME: { actions: ["clearAutoSuppressed", "announceResume", "queueEvaluateReady"] },
          FORCE_HOLD: { actions: ["addForceHold", "announceForceHold"] },
          FORCE_RELEASE: { actions: ["releaseForceHold", "announceForceRelease", "queueEvaluateReady"] },
        },
      },
    },
  } as const;
}
