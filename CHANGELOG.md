# Changelog

All notable changes to this project will be documented in this file.

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
