# Codex Execution Plans (ExecPlans)

This document defines how to author and maintain an executable specification (“ExecPlan”). Treat every ExecPlan as the only context a brand-new contributor has: it must be self-contained, novice-friendly, and outcome-focused.

## How to Use ExecPlans

1. **Authoring**: When instructed to create an ExecPlan, read this file fully, then start from the skeleton below. Populate every section; do not skip placeholders. Plans are “living documents”: as you research, implement, or discover surprises, immediately update the plan.
2. **Executing**: Once the plan exists, follow it milestone by milestone without waiting for extra prompts. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` accurate at all times. If the plan must change, edit it and record the decision.
3. **Discussing**: When collaborating or pausing work, the ExecPlan must let someone else resume from scratch. Capture rationale for every deviation or insight so a future executor can restart with only this file.

## Non‑Negotiable Requirements

- Every ExecPlan is self-contained and explains all terminology it uses.
- It must enable a novice to implement and validate the feature end-to-end.
- It specifies observable behavior, not just “code changes”.
- It remains up to date as work proceeds; never leave stale sections.
- It defines acceptance criteria that a human can verify (commands, URLs, test names, expected outputs).

Focus on purpose first: explain why the work matters to the user and how to see it working. Then enumerate the precise edits, commands, and validations. Assume the executor can list files, read source, run tests, and start the project, but has zero historical context.

## Formatting Rules

ExecPlans live inside a single fenced code block labeled `md` (unless the entire file is only the plan). Within that fence, do not use additional triple backticks—use indentation for code, commands, and diffs. Separate headings with two newlines. Narrative sections should be prose-first; use lists sparingly. Checklists are required only inside `Progress`.

## Living Sections

Each ExecPlan must contain and maintain the following sections:
- `Progress` (checkbox list with timestamps)
- `Surprises & Discoveries` (observations + evidence)
- `Decision Log` (decision, rationale, date/author)
- `Outcomes & Retrospective` (result vs. goal)

Update them continuously. If you change course, document why.

## Milestones

Break the effort into independently verifiable milestones. For each milestone, describe:
- scope and intent
- what will exist afterward that did not exist before
- commands to run and expected observations
- how success is verified

Keep the narrative readable: goal → work → result → proof.

## Skeleton of a Good ExecPlan

```md
# <Short, action-oriented description>

This ExecPlan is a living document. Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` current.

Reference: `.agent/PLANS.md` (this file).

## Purpose / Big Picture

Explain what the user gains and how to observe the change in action.

## Progress

- [ ] (YYYY-MM-DD HH:MMZ) Example task.

## Surprises & Discoveries

- Observation: …  
  Evidence: …

## Decision Log

- Decision: …  
  Rationale: …  
  Date/Author: …

## Outcomes & Retrospective

Summarize achievements, remaining gaps, and lessons.

## Context and Orientation

Describe current behavior, key files (full paths), terminology. Assume zero prior knowledge.

## Plan of Work

Detailed prose of the edits/additions in order. Name files, functions, and expected content.

## Concrete Steps

Exact commands with working directories and expected transcripts.

## Validation and Acceptance

How to run tests or manual checks, inputs/outputs, and success criteria.

## Idempotence and Recovery

How to rerun safely, and fallback steps if something fails mid-way.

## Artifacts and Notes

Important logs, diffs, or snippets (indented within the single fence).

## Interfaces and Dependencies

List libraries, modules, APIs touched, and required signatures or behaviors.
```

## Guidelines and Safety

- Repeat assumptions instead of referencing external docs. If knowledge is required, restate it here.
- Prefer additive, testable changes. If destructive actions are unavoidable, explain rollback paths.
- Include proofs: commands, test output, screenshots/log descriptions that demonstrate success.
- Keep plans idempotent. If a step can be reapplied without harm, say so; if not, provide recovery steps.

By following these rules, a stateless agent—or a human novice—can read the ExecPlan alone and produce a working result.
