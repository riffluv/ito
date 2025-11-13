# ExecPlans

When implementing a complex feature, multi-hour investigation, or any change that touches multiple systems (e.g., network performance, drag latency, service-worker update flow), create an ExecPlan before coding. ExecPlans are defined in `.agent/PLANS.md` and must be kept in sync as work progresses.

Key triggers:
- tasks affecting multiplayer stability (6–8 participants) or requiring coordinated telemetry
- systemic performance efforts (drag/drop latency, UI response, phase transitions)
- any effort to push multi-user drag operations or critical UI actions to “console-level” responsiveness using every modern technique available
- service worker / update pipeline changes where downtime would break active games
- any mission where the user explicitly requests an ExecPlan

If any trigger applies, stop and produce an ExecPlan that follows `.agent/PLANS.md` to the letter, then execute the plan step by step, updating the living sections as you go.
