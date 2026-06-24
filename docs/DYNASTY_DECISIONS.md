# Football JS Dynasty Decisions

## Purpose

Dynasty should become the long-term team-building mode for Football JS, but the first implementation should stay small enough to ship and test. The mode will use the existing fictional six-team league, roster identities, ratings, match stats, schedule-capable match flow, and deterministic simulation.

## Reference Scan

Public football-game references are useful for feature categories, not for copying presentation or exact mechanics.

- EA Sports College Football 26 public Dynasty material emphasizes long-term program systems such as recruiting, transfer portal, coaching carousel, coach abilities, program identity, Dynasty Central, and a broader weekly management loop.
- Madden NFL 26 public franchise material emphasizes a franchise hub, weekly strategy/actions, coach/player management, progression, presentation, and season-long context.
- Madden NFL 27 public franchise direction emphasizes deeper living-league behavior such as player personality, emergent actions, stronger staff/team management, and more dynamic franchise events.
- I did not find enough stable official CFB 27 Dynasty detail to rely on as implementation input, so CFB 27 remains a watch item rather than a requirement source.

Useful source links:

- [EA Sports College Football 26 Dynasty Deep Dive](https://www.ea.com/games/ea-sports-college-football/college-football-26/news/cfb26-campus-huddle-dynasty-deep-dive)
- [EA Sports Madden NFL 26 Franchise Deep Dive](https://www.ea.com/games/madden-nfl/madden-nfl-26/news/madden-nfl-26-franchise-deep-dive)
- [EA Sports Madden NFL 27 Franchise Mode](https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-franchise-mode)

## Core Product Decision

Football JS Dynasty will start as a compact college-style program mode, not a full pro-franchise clone.

Chosen first depth:

- One user-controlled program.
- Six-team league schedule.
- Weekly hub with standings, upcoming game, roster snapshot, team strengths, and season goals.
- Deterministic simulation for non-user games.
- Season stats and simple leaders.
- End-of-season progression and roster turnover after the base loop is reliable.

Deferred:

- Full recruiting board.
- Transfer portal.
- Coach carousel.
- Staff tree.
- NIL/budget/facilities economy.
- Custom conferences.
- Full roster editing and substitutions.

## Phase Map

```mermaid
flowchart TD
  A["Phase 0: Dynasty Shell"] --> B["Phase 1: Season Core"]
  B --> C["Phase 2: Stats, Stories, and Awards"]
  C --> D["Phase 3: Player Progression"]
  D --> E["Phase 4: Recruiting-Lite"]
  E --> F["Phase 5: Program Management"]
  F --> G["Phase 6: Offseason and Multi-Year Saves"]
```

## Implementation Phases

### Phase 0: Dynasty Shell

Status: Complete in `1.22.0`.

Goal: Make Dynasty visible as a hub destination without starting a new mode.

Scope:

- Add Dynasty button in Football Hub.
- Show non-playable Dynasty overview.
- Link to this decision file.
- Keep Play Now flow unchanged.

Acceptance:

- No gameplay starts from the Dynasty shell.
- No duplicate team-selection path is introduced.
- Build passes.

Completion notes:

- The Football Hub contains a Dynasty destination.
- The Dynasty destination is a non-playable planning shell.
- The shell points back to this decision map and keeps Play Now separate.

### Phase 1: Season Core

Status: Complete in `1.22.19`.

Goal: Create the first real dynasty save loop.

Scope:

- `DynastySaveData` schema and IndexedDB repository.
- Six-team season schedule.
- Standings table.
- Week advance.
- User game launch from weekly matchup.
- Simulate non-user games deterministically.

Acceptance:

- Same seed creates same schedule and results.
- Reloading restores the same week, standings, and user team.
- Play Now remains separate from Dynasty.

Minor update plan:

1. Season-core contract: add the `DynastySaveData` schema and deterministic six-team round-robin schedule generator. Shipped in `1.22.14`.
2. Save repository: persist, load, reset, and migrate the active dynasty save through IndexedDB. Shipped in `1.22.15`.
3. Dynasty hub view: show the active user program, current week, upcoming game, schedule, and standings in the Football Hub Dynasty tab. Shipped in `1.22.16`.
4. Weekly advance: simulate non-user games deterministically, update standings, and allow the user matchup to launch from the Dynasty path. Shipped in `1.22.17`.

Patch hardening plan:

1. Reload and migration hardening: validate corrupt saves, missing teams, stale schema versions, and safe fallback behavior. Shipped in `1.22.18`.
2. Flow hardening: prevent Play Now and Dynasty state from leaking into each other, including team settings, kickoff setup, and completed-game return routing. Shipped in `1.22.19`.

Completion notes:

- The Dynasty hub loads, creates, and persists the active save through the repository.
- Weekly non-user games and quick-sim user games update standings deterministically.
- Dynasty matchup launch settings are runtime-only, and Play Now settings remain separate.

### Phase 2: Stats, Stories, and Awards

Status: Complete in `1.22.25`.

Goal: Let the season feel persistent through stats and commentary.

Scope:

- Team and player season stat aggregation from `GameStatsModel`.
- Weekly leaders.
- Basic award watch lists.
- Postgame and halftime story hooks can read season context.

Acceptance:

- Simulated and user-played games produce valid cumulative stats.
- No impossible stats are generated.
- Commentary remains generic and factual.

Minor update plan:

1. Season stats contract: add team-level season stat rows, deterministic per-game stat lines, aggregate rebuilds, and legacy stat hydration. Shipped in `1.22.20`.
2. Weekly leaders: expose passing, rushing, scoring, turnover, and yardage leaders from the current Dynasty save. Shipped in `1.22.21`.
3. Story hooks: add compact Dynasty context summaries for halftime, postgame, and weekly hub copy. Shipped in `1.22.22`.
4. Award watch lists: add deterministic offensive, defensive, and special teams watch rows based on season stats. Shipped in `1.22.23`.

Patch hardening plan:

1. Stat validation hardening: reject missing, negative, mismatched, or impossible aggregate stat rows and preserve migration safety. Shipped in `1.22.24`.
2. Story presentation hardening: keep Dynasty story copy generic, factual, and absent from Play Now unless a Dynasty context exists. Shipped in `1.22.25`.

Completion notes:

- Dynasty saves now carry cumulative team season stats, weekly leaders, award watch rows, and compact story context for the hub, halftime report, and postgame stats.
- Dynasty validation rejects corrupt stat aggregates and missing, duplicate, negative, or mismatched stat rows.
- Dynasty story copy is suppressed for Play Now and for malformed Dynasty context.

### Phase 3: Player Progression

Goal: Make roster identity matter over time.

Scope:

- End-of-game XP or performance points.
- End-of-week training summary.
- Small rating changes based on position and archetype.
- Regression or fatigue-like modifiers stay presentation-only at first.

Acceptance:

- Rating changes are bounded and deterministic.
- Overall recalculates from attribute weights.
- Gameplay behavior does not change until explicitly approved.

### Phase 4: Recruiting-Lite

Goal: Add a compact college-style roster-building layer.

Scope:

- Small prospect pool.
- Team needs.
- Weekly recruiting points.
- Three pitch styles: playing time, team strength, program fit.
- Signing class at season end.

Acceptance:

- Recruiting can be completed in one simple weekly screen.
- Prospects are fictional and deterministic.
- Existing roster size constraints remain valid.

### Phase 5: Program Management

Goal: Add strategic program identity without overwhelming the player.

Scope:

- Coach goals.
- Program strengths.
- Simple budget allocation between recruiting, training, facilities, and staff.
- Staff modifiers as small deterministic bonuses.

Acceptance:

- Every modifier is visible and testable.
- No hidden comeback or rubber-band logic.
- Budget choices affect future phases, not current-play outcomes.

### Phase 6: Offseason and Multi-Year Saves

Goal: Close the long-term loop.

Scope:

- Departures.
- Incoming class.
- Roster review.
- Schedule generation for next season.
- Dynasty history.

Acceptance:

- Multiple seasons can be advanced without corrupting rosters.
- Team history and season records persist.
- Save migration handles schema changes.

## Open Decisions

- Should Dynasty start with user-only gameplay and fully simulated opponent drives, or require Play Now match flow for every user game?
- Should season length be five games, round-robin, or a configurable short schedule?
- Should recruiting appear before or after player progression?
- Should all six teams recruit simultaneously in Phase 4, or should opponents receive simulated class strength only?
- Should Dynasty use separate presentation commentary categories, or reuse existing game/opinion lines first?

## Non-Copying Guardrails

- Use original Football JS layout and terminology.
- Do not copy EA menu structure, feature names, art direction, or exact flows.
- Do not use real teams, real players, real coaches, real conferences, or protected branding.
- Treat commercial games as category references only.
