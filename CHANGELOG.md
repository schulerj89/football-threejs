# Changelog

All notable changes to this project will be documented in this file.

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
