# AGENTS.md

## Project

This repository is a low-poly 3D American football game prototype built with Three.js, Vite, TypeScript, WebGL, and a future WebGPU path. The current milestone is a one-defender rushing drill with a controllable primitive ball carrier, one simple pursuing defender, touchdown scoring, tackle and out-of-bounds outcomes, dead-ball spotting, signed yardage, moving line of scrimmage, and delayed reset.

## Current Non-Goals

- No stadium
- No crowd
- No imported assets
- No throwing
- No loose-ball physics
- No blockers
- No formations
- No multiple defenders
- No diving tackles
- No tackling animations
- No passing
- No pathfinding library
- No sprinting
- No animation
- No game clock
- No downs
- No first downs
- No possession changes
- No additional players
- No celebration animation
- No stadium presentation
- No center or snap animation
- No full game rules
- No menus
- No physics engine
- No collision with other players
- No unrelated refactoring

Stop after the current milestone unless the user explicitly asks for the next feature.

## Versioning And Release Workflow

- For every user request, decide whether the change is `major`, `minor`, or `patch` before editing.
- Use `major` for incompatible gameplay, API, save-data, or architecture changes.
- Use `minor` for new game features, scenes, systems, or user-visible capabilities that preserve existing behavior.
- Use `patch` for fixes, small polish, documentation corrections, and test-only updates.
- Bump `package.json` for each completed request.
- Update `CHANGELOG.md` in the same change set with the date, version, and user-visible summary.
- Commit and push each independent request individually. Do not hold completed work to batch later.

## Implementation Rules

- Keep field construction in `src/field.ts` or a similarly dedicated field module.
- Use primitive Three.js geometry and simple materials during graybox work.
- Keep input, simulation, and visual synchronization in separate modules.
- The gameplay model owns player position, velocity, and facing; Three.js meshes only display that state.
- The gameplay model owns play state and ball possession; the ball mesh is never authoritative.
- The gameplay model owns play results, start spots, dead-ball spots, yards gained, and scoring team data; UI and meshes only display that state.
- Keep conversion between world units and football yards centralized.
- Goal-line detection and scoring must use gameplay coordinates, not mesh positions.
- Sideline and dead-ball spotting must use gameplay coordinates, not mesh positions.
- Defender AI must use gameplay positions and stay deliberately simple.
- Tackling must use explicit configurable collision radii.
- Preserve the fixed three-quarter gameplay camera unless the user asks for a camera system.
- Handle browser resizing whenever camera or renderer code changes.
- Keep renderer choices isolated enough that WebGPU can be added without rewriting gameplay scene construction.
- Add or update browser smoke coverage when scene startup, camera framing, renderer boot, resize behavior, controls, or play state changes.

## Done Criteria For This Milestone

- The project builds and launches without console errors.
- A live play records its starting ball spot and completed play result as gameplay data.
- Tackle and out-of-bounds plays record the dead-ball spot, signed yards gained or lost, and reset the next snap at that spot.
- Touchdowns keep the existing score, message, and reset behavior.
- The visible line of scrimmage follows the current gameplay ball spot.
- Positive gain, negative gain, out-of-bounds, and touchdown outcomes have deterministic tests.
- Existing tests pass.
- The browser smoke test proves score, tackle, and out-of-bounds outcomes work.
