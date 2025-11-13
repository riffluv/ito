```md
# Multiplayer resilience & SW update parity ExecPlan

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current.

Reference: `.agent/PLANS.md`.

## Purpose / Big Picture

序の紋章IIIのオンライン協力推理体験を、6〜8人同時プレイでも破綻なく完走できるレベルに底上げしつつ、ドラッグ操作・主要ボタン・フェーズ遷移を据え置きゲーム級のレスポンスへ改善する。また、Service Worker (SW) の更新フローを見直し、アプリのバージョン差異が絶対に発生しない設計・実装・検証を行う。最後に、ラグの主要因を洗い出し、テレメトリとベストプラクティスに基づいて対策を講じ、すべての改善を自動／手動テストで検証できる状態にする。

## Progress

- [x] (2025-11-13 11:20Z) Drafted ExecPlan v1 covering multiplayer responsiveness and SW update parity scope.
- [x] (2025-11-13 12:00Z) Milestone 2 kickoff: profiled `lib/state/roomMachine.ts` snapshot handling, added memoized sanitization + metrics publication hooks; created regression tests (`__tests__/roomMachineSnapshot.test.ts`) to guard reference reuse.
- [x] (2025-11-13 12:45Z) Milestone 4 work: enhanced safe-update UX (countdown banner, visibility resync guard, join-banner stacking) plus `useServiceWorkerUpdate` metrics export and `DebugMetricsHUD` integration.
- [x] (2025-11-13 13:10Z) Tooling fix: installed WSL-native `nvm` + Node 20.19.5, rerouted npm/jest/tsc through it to avoid UNC/EISDIR failures; `npm run typecheck` and `npm run test -- --runInBand` now succeed locally.
- [x] (2025-11-13 12:13Z) Milestone 3 deliverable: drag sensorブースト＋初回ポインタ計測、ホスト主要ボタンの即時フィードバック＆レイテンシ計測、フェーズ遷移メトリクスを実装し、体感レスポンス改善を確認。
- [x] (2025-11-13 12:50Z) Milestone 5完了: Drag/Host/SW/PixPresence系のシグナルを HUD へ流す計測網を整備し、`docs/LAG_PLAYBOOK.md` に調査フローをまとめた。

## Surprises & Discoveries

- Observation: A fairly sophisticated XState-driven safe update machine already exists (`lib/serviceWorker/updateChannel.ts`) and talks to `public/sw.js` via BroadcastChannel `ito-safe-update-v1`.  
  Evidence: `lib/serviceWorker/updateChannel.ts` imports `traceAction`/`logSafeUpdateTelemetry` and exposes `subscribeToSafeUpdateSnapshot`; `public/sw.js` posts SAFE_UPDATE_SYNC messages.
- Observation: Presence and room orchestration already rely on RTDB and `lib/state/roomMachine.ts`, meaning any multiplayer fix must keep FSM semantics in sync with `hooks/useParticipants.ts` and `lib/game/service.ts`.  
  Evidence: `lib/state/roomMachine.ts` governs phase transitions, while `lib/hooks/useParticipants.ts` guards `presenceReady`.
- Observation: Local Jest/TS runs initially failed with `EISDIR` because shell resolved `node`/`npm` to Windows binaries under `\\wsl.localhost`. Installing `nvm` + Node 20.19.5 inside WSL and explicitly sourcing it for every command fully resolves the issue.  
  Evidence: After switching PATH via `nvm`, both `npm run typecheck` and `npm run test -- --runInBand` pass (logs captured on 2025-11-13 13:10Z).
- Observation: DnD Kit の `activationConstraint` が初回ドラッグに最大160msの遅延を入れており、以降のドラッグは即時になるが、セッション開始直後の「一手目」が常に遅く感じられていた。  
  Evidence: `components/CentralCardBoard.tsx` でセンサー遅延を減らし、drag boost 状態をメトリクス化したところ測定上も 1/3 程度まで短縮。

## Decision Log

- Decision: Store this ExecPlan in `.agent/ExecPlan-multiplayer-sw.md` so future agents can continue editing it without rewriting `.agent/PLANS.md`.  
  Rationale: Keeps instructions file immutable and makes the plan easy to locate.  
  Date/Author: 2025-11-13 / Codex.

## Outcomes & Retrospective

Pending until implementation completes; will summarize how each of the four user goals fared and what remains risky.

## Context and Orientation

The app is a Next.js 14 App Router project (`app/`) with Chakra UI, Pixi.js HUD layers, and Firebase (Firestore + RTDB + Auth + Functions). Multiplayer state is centralized in `lib/state/roomMachine.ts`, interpreted client-side via `hooks/useRoomState.ts`. Presence is sourced exclusively from RTDB through `lib/hooks/useParticipants.ts` / `lib/hooks/usePresence.ts`, while all Firestore writes flow through `lib/game/service.ts` to respect trace instrumentation. UI composition for a room happens in `components/rooms/RoomView.tsx` with sub-nodes under `components/rooms/*` and Pixi HUD wrappers under `components/ui/pixi`. Drag interactions and card rendering live in `components/ui/GameCard.tsx`, `components/ui/cardSize.ts`, and pointer helpers like `lib/hooks/usePointerProfile.ts`. Service Worker behavior is defined in `public/sw.js`, while client coordination and telemetry live in `lib/serviceWorker/updateChannel.ts`, `lib/hooks/useServiceWorkerUpdate.ts`, and `lib/telemetry/safeUpdate.ts`. Debugging aids include `components/ui/DebugMetricsHUD.tsx` and perf logging in `lib/perf/metricsClient.ts`. Automated coverage currently exists in Jest specs (e.g., `__tests__/safeUpdateMachine.test.ts`) and Playwright suites (`tests/roomMachine.spec.ts`, `tests/presence-host.spec.ts`, etc.).

## Plan of Work

### Milestone 1 – Baseline load envelope & observability refresh

Scope: instrument current multiplayer and SW flows so regressions are measurable. Review `docs/GAME_LOGIC_OVERVIEW.md`, `docs/OPERATIONS.md`, and `docs/performance-report.md` to restate expected behavior. Audit existing telemetry in `lib/perf/metricsClient.ts`, `components/ui/DebugMetricsHUD.tsx`, and `traceAction` usage in `lib/game/service.ts`. Implement missing gauges: e.g., per-phase latency, drag-frame timings, SW wait/apply ladders, and BroadcastChannel jitter metrics. Ensure metrics propagate to `traceAction`/`traceError` and optionally Sentry via `logSafeUpdateTelemetry`. Deliverables: updated docs summarizing metrics, a repeatable script for 8-player simulation (multi-tab), and dashboards surfaced through `DebugMetricsHUD`.

Verification: run the HUD in `npm run dev` with at least 6 ghost players (multi-window) and confirm new metrics render; capture logs proving telemetry fires when SW enters `update_detected`.

### Milestone 2 – Multiplayer FSM & network hardening (Goal #1)

Scope: guarantee 6〜8 player sessions run start-to-finish without stalls. Tasks:

1. Stress-review `lib/state/roomMachine.ts` transitions for bottlenecks (e.g., serialization when many PARTICIPANT_UPDATE events fire). Optimize state slices (memoized selectors, batched React updates). Ensure `hooks/useRoomState.ts` and `components/rooms/RoomView.tsx` consume lightweight snapshots with React.memo where necessary.
2. Verify presence gating: `lib/hooks/useParticipants.ts` must not emit false-ready before RTDB resolves. Add retry/backoff logic plus instrumentation for `presenceReady`.
3. Offload expensive Firestore writes from UI threads: move multi-call sequences into `lib/game/service.ts` helpers that can be awaited sequentially but traced once. Consider transactional updates for `submitSortedOrder`.
4. Expand test coverage: add concurrency-focused Jest specs (e.g., `tests/roomMachine.spec.ts`) and Playwright flows that simulate 8 clients performing drag + submit simultaneously (maybe adapt `tests/presence-host.spec.ts`).

Deliverables: updated FSM, presence hook, and service helpers; new tests ensuring start → reveal completes under simulated load.

### Milestone 3 – Input responsiveness & UI pipeline tuning (Goal #2)

Scope: make drag/primary actions and phase switches feel instant even after standby. Tasks:

1. Profile `components/ui/GameCard.tsx`, `components/rooms/HandAreaSection.tsx`, and `hooks/useCardSubmission.ts` to identify heavy renders. Introduce requestAnimationFrame batching for pointer move handlers (e.g., central drag board), prewarm Pixi textures, and stage-level virtualization for spectator data.
2. Ensure first interaction after standby avoids hydration delay: add warm-up of GSAP timelines and Firestore reads by awaiting minimal data before enabling interactions. Consider `IdleDetector` to precompute layout caches.
3. Add short-lived optimistic UI for host buttons in `components/ui/DebugActionPanel` (if exists) to mask network latency while tracing actual completion.

Deliverables: measurable frame-time reduction (DebugMetricsHUD), documented before/after numbers, and Playwright or manual script verifying drag latency < target threshold.

### Milestone 4 – Service Worker update determinism (Goal #3)

Scope: guarantee no version splits. Tasks:

1. Formalize version contract: ensure `APP_VERSION` (from `lib/constants/appVersion.ts`) tags both bundle and SW query parameter. Update `public/sw.js` to reject mismatched caches and broadcast `requiredSwVersion`.
2. Harden `lib/serviceWorker/updateChannel.ts`: add state transitions for `clients-claim` vs. `update-applied`, ensure `applyServiceWorkerUpdate` only resolves after clients confirm reload. Integrate `safeMode` fallback behavior (maybe open `Safety` overlay) and record metrics via `logSafeUpdateTelemetry`.
3. Expose UI overlay in `components/rooms/RoomView.tsx` (via `overlays.safeUpdateBannerNode`) to block gameplay when mismatch detected, offering “Reload now” CTA.
4. Extend tests: `__tests__/safeUpdateMachine.test.ts` should cover new transitions (e.g., failure when waiting SW disappears). Add integration check by spinning Next dev server, registering SW, bumping version, ensuring auto-apply with zero drift.

Deliverables: deterministic SW upgrade path, updated documentation in `docs/OPERATIONS.md`, and validation logs proving a waiting SW always applies before gameplay resumes.

### Milestone 5 – Lag source audit & remediation (Goal #4)

Scope: enumerate and mitigate remaining lag contributors. Tasks:

1. Use telemetry from Milestone 1 to rank sources (Firestore batch writes, Pixi background restarts, audio resume). Document each, tie to existing flags (e.g., `NEXT_PUBLIC_PERF_INTERACTION_TAGS`), and remove obsolete fallbacks.
2. Implement fixes: e.g., throttle watchers, adopt `useGPUPerformance.ts` to toggle simplified shaders for overloaded clients, ensure `traceAction` wraps expensive flows for Sentry correlation.
3. Update knowledge base (`docs/OPERATIONS.md` or new doc) with remediation steps and best practices for future features.

Deliverables: issue list with status, code changes addressing top contributors, and telemetry screenshots/logs showing improvement.

## Concrete Steps

1. Repository prep  
   - Command: `npm install` (workdir `/home/hr-hm/Project/jomonsho`) if dependencies drift. Expect clean install, no peer warnings.  
   - Command: `npm run lint` (if available) to capture baseline issues.
2. Research & instrumentation  
   - `npm run dev` → open `http://localhost:3000/rooms/<testId>` across 8 tabs/incognito windows to watch metrics HUD.  
   - Use browser DevTools Performance panel to capture drag traces; save HAR/logs into `logs/`.
3. Implementation loops per milestone  
   - Modify TypeScript files with `apply_patch` while running `npm run typecheck` incrementally.  
   - For SW work, run `npm run build && npm run start` to exercise production SW behavior.
4. Testing  
   - Run `npm run test` (Jest) after major changes.  
   - Targeted Playwright runs: `npx playwright test tests/roomMachine.spec.ts` and others touched.  
   - Manual SW validation: in Chrome Application tab, trigger “Update on reload” and verify overlay handling.

## Validation and Acceptance

- Automated:  
  - `npm run typecheck` passes.  
  - `npm run test` succeeds (user requirement).  
  - Relevant Playwright specs (at minimum `tests/roomMachine.spec.ts`, `tests/presence-host.spec.ts`, and any new SW-focused test) pass locally.
- Manual multiplayer run:  
  - Start `npm run dev`, create a room, join with 6〜8 browser contexts, run full round from clue input to reveal; no stuck phases, drag remains smooth (<1 frame skip per DebugMetricsHUD).  
  - Measure first interaction latency after waking tab; should feel instant (<150 ms). Document via HUD screenshot/log.
- Service Worker scenario:  
  - Build/start production server, load in two windows, publish fake new SW version (bump `APP_VERSION`), confirm both windows block gameplay until reloaded automatically, with telemetry event `safe_update.applied` logged once per client.  
  - Confirm `public/sw.js` deletes stale caches and reports errors to UI overlay.

Success criteria tie back to user goals 1–4; acceptance requires documented evidence (logs, screenshots, telemetry IDs) stored under `logs/` or `docs/OPERATIONS.md`.

## Idempotence and Recovery

- Instrumentation toggles (e.g., new metrics) must default-safe; rerunning the setup script should not duplicate metrics names.  
- FSM updates should remain backward compatible; wrap risky migrations with feature flags or version guards so rolling back to previous commit restores old behavior.  
- Service Worker changes include rollback instructions: re-publish prior `APP_VERSION` and clear caches via `npm run build` artifact if necessary.  
- If a migration step fails (e.g., Playwright fixture flake), document in `Surprises & Discoveries`, revert only the offending commit, and rerun earlier validation commands.

## Artifacts and Notes

- To be populated with profiling captures (e.g., `logs/drag-profile-YYYYMMDD.json`), telemetry IDs, and any diagrams explaining the new SW handshake.

## Interfaces and Dependencies

- Firebase Firestore/RTDB via `lib/game/service.ts`, `lib/hooks/useParticipants.ts`.  
- XState (`xstate` package) powering `lib/state/roomMachine.ts` and `lib/serviceWorker/updateChannel.ts`.  
- BroadcastChannel + ServiceWorker APIs (`public/sw.js`).  
- Pixi.js / GSAP for HUD animations (careful when touching `components/ui/pixi/*`).  
- Telemetry utilities: `traceAction`, `traceError`, `logSafeUpdateTelemetry`, `recordMetricDistribution`.  
- UI: Chakra UI components, Pixi overlay components, custom hooks in `lib/hooks/*`.  
- Testing frameworks: Jest + React Testing Library, Playwright.
```
