```md
# Fix sort-submit reveal stall (3+ players)

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current.

Reference: `.agent/PLANS.md`.

## Purpose / Big Picture

Players with 3+ participants get stuck during the reveal sequence: the third card never flips and the result overlay never appears. Goal: make the full flip chain, evaluation, and room status transition complete reliably for both success and failure rounds without regressing the 2-player flow.

## Progress

- [x] (2025-11-28 10:00Z) Collected requirements and created ExecPlan.
- [x] (2025-11-28 10:02Z) Pinpointed root cause in reveal scheduling/evaluation path.
- [x] (2025-11-28 10:03Z) Implemented fix to keep flip chain and finalize path running for 3+ players.
- [x] (2025-11-28 10:06Z) Added regression test covering multi-card reveal completion.
- [x] (2025-11-28 10:07Z) Ran targeted Jest test for the new scenario.

## Surprises & Discoveries

- Observation: `useRevealAnimation` rescheduled the entire flip plan on every render because `runRealtimeEvaluation` depended on a fresh `orderData` object; the effect cleared timers each time `revealIndex` advanced, so the chain never reached the 3rd card.  
  Evidence: Scheduling effect dependency list included `runRealtimeEvaluation`, which was recreated each render (orderData literal in `CentralCardBoard`), causing `clearScheduledTimers()` to fire repeatedly.
- Observation: Jest fake timers did not cooperate with the reveal prewarm/idle sequence, leaving `revealIndex` stuck at 0 in tests; switching to real timers with mocked-down motion constants produced deterministic coverage.  
  Evidence: `jest.getTimerCount()` stayed nonzero after `advanceTimersByTime`, but real timers + short delays let the flip chain and finalize path complete in ~120ms.

## Decision Log

- Decision: Start with code-path investigation before crafting UI repro harness.  
  Rationale: Report is deterministic and isolated to reveal scheduling; code audit should surface race/cleanup issues faster.  
  Date/Author: 2025-11-28 / Codex
- Decision: Stabilize realtime evaluation via refs (orderData/orderListLength) so the scheduling effect runs once per reveal instead of every render.  
  Rationale: Avoids timer resets that halted flip progression for 3+ players while keeping data fresh.  
  Date/Author: 2025-11-28 / Codex
- Decision: Use real timers with reduced motion constants in regression test to mirror runtime behavior while keeping the test fast and deterministic.  
  Rationale: The reveal hook relies on idle/prewarm flows that modern fake timers skipped; real timers avoid brittle scheduler coupling.  
  Date/Author: 2025-11-28 / Codex

## Outcomes & Retrospective

- Achieved: Stabilized reveal scheduling by decoupling realtime evaluation from render churn; multi-card flip chain now runs to completion and finalize triggers after the last card. Added regression test to guard against reintroducing timer resets.
- Remaining: Recommend a manual multi-browser smoke test in real UI to confirm audio/showtime cues, though logic now aligns with expected timeline.
- Lesson: Time-based hooks that depend on render-created objects should rely on refs or memoized inputs; otherwise effects can thrash timers.

## Context and Orientation

- Mode: `resolveMode="sort-submit"` (default).
- Symptom: With 3+ players, flip chain halts after 2nd card; after long wait the last number pops without animation, result overlay and `room.status` transition to `finished` never happen.
- Key files: `components/hooks/useRevealAnimation.ts`, `components/CentralCardBoard.tsx`, `components/ui/GameCard.tsx`, `lib/game/rules.ts`, `lib/game/resultPrefetch.ts`, `lib/state/roomMachine.ts`.
- Acceptance: All cards flip in order, result overlay and status transition occur for success and failure, 2-player behavior unchanged.

## Plan of Work

1. Audit `useRevealAnimation` scheduling and finalize logic; check dependencies that may reschedule or cancel timers mid-reveal.
2. Confirm interaction with `CentralCardBoard` fallback finalize path.
3. Implement fix to prevent premature timer resets and ensure evaluation/finalize run after the final flip (likely stabilizing callbacks/refs).
4. Add Jest regression focusing on multi-card reveal progression (3 players) to guard against timer rescheduling regressions.
5. Run targeted tests; if feasible, smoke-test reveal logic in isolation with fake timers.

## Concrete Steps

- Inspect `useRevealAnimation` effects, particularly dependencies controlling timer scheduling.
- Adjust scheduling/evaluation functions to be stable across renders (e.g., refs/useCallback) and avoid clearing timers mid-run.
- Add Jest test (`__tests__/useRevealAnimation.test.tsx`) using fake timers to assert revealIndex reaches list length and finalize is triggered for 3 cards.
- Run `npm test -- useRevealAnimation.test.tsx` and, if time permits, a quick sanity on related existing tests.

## Validation and Acceptance

- Automated: new Jest test passes; no existing tests broken.
- Behavioral (if time): simulate reveal timeline via fake timers; confirm `revealIndex` hits `orderListLength`, `finalizeReveal` invoked once, and timers are not wiped mid-run.

## Idempotence and Recovery

- Fix is localized to reveal hook; rerunning tests is safe.
- If test flakiness arises, re-run with `--runInBand` to avoid timer interference.

## Artifacts and Notes

- Keep any new mocks/stubs scoped to the new test to avoid cross-suite impact.

## Interfaces and Dependencies

- Touching `useRevealAnimation` (timers, realtime evaluation, finalize scheduling).
- Relies on `evaluateSorted`, `resultPrefetch` cache, and `finalizeReveal` service.
```
