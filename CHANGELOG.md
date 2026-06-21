# Changelog

All notable changes to this project will be documented in this file.

## [0.14.0] - 2026-06-21

### Added

- Added a two-minute offensive score-attack challenge model with a 120-second clock that starts on the first snap and ticks from supplied delta time.
- Added continuous clock ticking across live plays, dead-play result delays, and pre-snap time between plays, with clamping at zero.
- Added `gameOver` handling that lets a live play finish after time expires, prevents another snap, stores the final score, and restarts with `Enter`.
- Added HUD display for remaining time plus a minimal final-score game-over message.
- Added score-attack state to gameplay snapshots for deterministic tests.
- Added unit coverage for clock startup, delta ticking, zero clamping, live-play finish at zero, snap lockout after expiry, and restart reset behavior.

## [0.13.1] - 2026-06-21

### Fixed

- Kept formation and receiver route targets inside playable field bounds when the ball is spotted near a sideline.
- Kept AI-controlled non-carriers, including receivers running routes, inside the field while preserving ball-carrier sideline crossings as out-of-bounds results.
- Added regression tests for sideline formation placement, sideline receiver routes, and sideline dead-ball resets.

## [0.13.0] - 2026-06-21

### Added

- Added `Slant Flat` as a fourth data-defined selectable passing play with a quarterback, two receivers, two coverage defenders, and one pass rusher.
- Evolved passing play data from a single receiver ID to an ordered eligible-receiver list while preserving Quick Pass as a one-receiver play.
- Added data-defined short slant and flat/outside receiver routes that begin only after the snap.
- Added gameplay-owned selected-receiver state with `E` target cycling before a throw, `F` throwing to the selected receiver, and reset restoration to the default target.
- Added a compact HUD target label for passing plays without changing player visuals.
- Added deterministic tests for Slant Flat play lookup, formation placement, route starts, receiver cycling, selected-target throws, selection lockout after a throw, reset defaulting, and browser keyboard controls.

## [0.12.0] - 2026-06-21

### Added

- Added per-play forward-pass eligibility for Quick Pass.
- Allowed the quarterback to scramble normally after the snap while still enforcing the original line-of-scrimmage passing rule.
- Added a documented line-of-scrimmage epsilon in `src/passRules.ts` to prevent floating-point noise from changing eligibility.
- Added `PAST LINE OF SCRIMMAGE` feedback for rejected ineligible pass attempts without changing ball state or marking `passAttempted`.
- Added deterministic tests for allowed passes behind the line, eligibility loss after crossing, permanent ineligibility after retreating, rejected throws, post-line tackles, rushing touchdowns, and reset restoration.
- Expanded browser smoke coverage for the rejected-pass HUD warning.

## [0.11.0] - 2026-06-21

### Added

- Added formal pass-rush behavior for Quick Pass: coverage defenders keep covering receivers while ordinary defenders rush the quarterback.
- Added sack classification for live passing plays when the quarterback still has possession, has not thrown, and has not crossed the line of scrimmage.
- Added `sack` as a gameplay play-result type with dead-ball spotting, signed yardage, down advancement, and `SACK` HUD messaging.
- Added dedicated sack-rule classification in gameplay code without adding animation-only player states.
- Added deterministic tests for pre-throw sacks, negative sack yardage, post-throw quarterback contact, completed-pass tackle continuation, rushing-play tackle classification, and sack drive advancement.

## [0.10.1] - 2026-06-21

### Fixed

- Corrected Outside Run blocker pre-snap facing so blockers hold a neutral stance facing the defense before the snap.
- Separated formation pre-snap facing from post-snap blocking lane targets in playbook formation data.
- Added deterministic tests for Outside Run pre-snap facing, pre-snap frame stability, post-snap blocker turning, reset restoration, and Inside Run facing.

## [0.10.0] - 2026-06-21

### Added

- Added `Quick Pass` as a third data-defined selectable play with quarterback, receiver, blocker, coverage defender, and two additional defenders.
- Added receiver route movement after the snap and a single `F` pass control that throws once toward a predicted receiver target.
- Added explicit gameplay ball states for `dead`, `possessed`, `inFlight`, `caught`, and `incomplete`.
- Added deterministic pass catch checks, possession transfer, and user-control transfer to the receiver after a completion.
- Added incomplete-pass results that end the play at the original line of scrimmage and advance the down.
- Added minimal `INCOMPLETE` HUD messaging and role-aware primitive player coloring for pass-play roles.
- Added deterministic tests for Quick Pass lookup, formation placement, receiver routes, ball-state transitions, catch transfer, incompletions, completed-pass yardage, and duplicate throw prevention.
- Expanded browser smoke coverage for Quick Pass selection, route start, and pass-button handling.

## [0.9.0] - 2026-06-21

### Added

- Added a data-driven rushing playbook with stable Inside Run and Outside Run play IDs.
- Added play definitions for display name, starting formation, ball-carrier role, initial movement direction, and blocker lane data.
- Added pre-snap keyboard selection with `1` for Inside Run and `2` for Outside Run.
- Added selected-play HUD display, pre-snap formation reset on selection, live-play selection lockout, and reset preservation.
- Added deterministic playbook and gameplay tests for play lookup, formation placement, invalid IDs, and selection restrictions.
- Expanded browser smoke coverage for play selection and live selection lockout.

## [0.8.0] - 2026-06-21

### Added

- Expanded the rushing drill to three offensive players versus three defensive players.
- Added a common gameplay player model with stable ID, team, role, position, velocity, facing, collision radius, and current state.
- Added data-driven initial formation and blocker lane targets.
- Added deterministic blocker-defender engagements, disengagement, impeded defender pursuit, and circle-based player separation.
- Rendered every player from gameplay roster state using shared primitive player visuals.
- Added deterministic tests for formation assignment, engagement, disengagement, separation, and tackle detection.
- Expanded browser smoke coverage for the six-player formation while preserving score, tackle, out-of-bounds, and turnover loops.

## [0.7.0] - 2026-06-21

### Added

- Added a dedicated drive/down model for current down, yards to go, line of scrimmage, and first-down marker state.
- Added first-and-10 drive starts, first-down awards, down advancement, and failed fourth-down turnover handling.
- Added `TURNOVER ON DOWNS` messaging and reset to a new offensive drill from the configured starting spot.
- Added a visible first-down line and HUD display for down, distance, ball position, and score.
- Added deterministic drive-rule tests for second-and-7, new first down, failed fourth down, touchdown reset, and duplicate result protection.
- Expanded browser smoke coverage for the four-down turnover loop.

## [0.6.0] - 2026-06-21

### Added

- Added structured gameplay play results with start spot, ending spot, reason, yards gained, and scoring team data.
- Added centralized world-unit to football-yard conversion for yardage calculations.
- Added dead-ball spotting for tackle and out-of-bounds outcomes, with the next snap resetting at the recorded spot.
- Added out-of-bounds play ending, signed yardage HUD display, and moving line-of-scrimmage visual sync.
- Added deterministic tests for positive gain, negative gain, out-of-bounds, touchdown, and next-play spot resets.
- Expanded browser smoke coverage for out-of-bounds play ending and sideline-spot reset.

## [0.5.0] - 2026-06-20

### Added

- Added one gameplay-owned defender with simple pursuit steering toward the ball carrier.
- Added configurable defender pursuit speed, steering rate, and tackle radius.
- Added tackle detection using gameplay positions and explicit collision radius, ending live play as `tackle`.
- Added a primitive defender visual and `TACKLED` HUD message with delayed reset.
- Added deterministic tests for pursuit direction, tackle contact, and tackle play-state changes.
- Expanded browser smoke coverage for both scoring by avoiding the defender and being tackled through contact.

## [0.4.0] - 2026-06-20

### Added

- Added live-play touchdown detection using gameplay coordinates at the opposing goal line.
- Added dead-ball transition, score counter, `TOUCHDOWN` message, and configurable auto-reset delay after scoring.
- Prevented movement while the play is dead.
- Added deterministic scoring tests for crossing, not crossing, delayed reset, and one touchdown per play.
- Expanded browser smoke coverage for the complete start, run, score, reset loop.

## [0.3.0] - 2026-06-20

### Added

- Added `preSnap`, `live`, and `dead` play states with focused transition tests.
- Added Space-to-start and R-to-reset controls for the basic play loop.
- Added plain gameplay-state ball possession and a primitive ball visual that follows a defined player carry attachment point.
- Prevented player movement during pre-snap.
- Expanded browser smoke coverage for pre-snap lock, live play start, possession, ball carry, and reset.

## [0.2.1] - 2026-06-20

### Fixed

- Removed the `D` debug-overlay hotkey so it no longer conflicts with WASD movement.
- Corrected horizontal keyboard movement so left and right match the fixed gameplay camera view.

## [0.2.0] - 2026-06-20

### Added

- Added keyboard movement for the placeholder player with WASD and arrow-key support.
- Added normalized diagonal movement, acceleration, deceleration, facing rotation, and playable-field clamping.
- Split player input, simulation, gameplay model state, and Three.js visual synchronization into dedicated modules.
- Added focused Vitest coverage for player movement behavior.
- Expanded the Playwright smoke test to prove keyboard movement in the browser.

## [0.1.0] - 2026-06-20

### Added

- Established the initial Vite, TypeScript, and Three.js project scaffold.
- Added a graybox American-football field with sidelines, end zones, yard lines, hash marks, and a marked line of scrimmage.
- Added one stationary primitive placeholder player at the line of scrimmage.
- Added a fixed three-quarter gameplay camera, resize handling, and an optional FPS/world-coordinate debug overlay.
- Added a Playwright browser smoke test for scene startup.
- Documented world scale, non-goals, scripts, and project workflow guidance.
