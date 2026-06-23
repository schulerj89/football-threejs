---
name: football-dynasty-planner
description: Plan Football JS dynasty/franchise mode scope, phase sequencing, decision records, and implementation tradeoffs. Use when Codex needs to evaluate how deep Dynasty should be, compare season/recruiting/player-development options, write or update dynasty roadmap docs, or keep long-term mode design aligned with Football JS systems without copying commercial football games.
---

# Football Dynasty Planner

## Workflow

1. Inspect current Football JS systems before proposing scope:
   - league data, rosters, ratings, game stats, match flow, audio/commentary, hub UI, persistence.
2. Check current public football-game references only for design patterns.
   - Prefer official sources and current public docs.
   - Avoid copying names, UI layouts, exact feature language, or protected trade dress.
3. Choose the smallest durable slice that creates a playable long-term loop.
   - Favor simulated weekly seasons, roster growth, and readable decisions before deep recruiting or contract systems.
4. Update `docs/DYNASTY_DECISIONS.md` when decisions change.
   - Include source links, constraints, rejected options, phase map, and open questions.
5. Keep implementation proposals phase-gated.
   - Each phase must specify data model, UI shell, simulation rules, persistence, tests, and non-goals.

## Decision Heuristics

- Build around existing Football JS strengths first: six-team league, ratings, stats, scorebug, halftime/postgame stories, rosters, and deterministic simulation.
- Do not add deep systems until the calendar, schedule, standings, and save format are stable.
- Treat recruiting, transfer portal, coach staff, budget, and facilities as phased strategy layers, not first-pass requirements.
- Keep user decisions understandable in one screen per week.
- Every dynasty outcome must come from deterministic data and persisted state, not presentation text.
- Simulated games must produce valid team/player stats that can feed standings, stories, and progression.

## Reference Rubric

Read `references/dynasty-decision-rubric.md` when making or revising dynasty-mode scope decisions.
