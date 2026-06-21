# AGENTS.md

## Project

This repository is a low-poly 3D American football game prototype built with Three.js, Vite, TypeScript, WebGL, and a future WebGPU path. The current milestone is a three-on-three rushing drill with a controllable primitive ball carrier, two AI blockers, three AI defenders, deterministic blocking engagements, a basic offensive drive, downs, yards-to-go, touchdown scoring, tackle and out-of-bounds outcomes, turnover-on-downs reset, dead-ball spotting, signed yardage, moving line of scrimmage, first-down marker, and delayed reset.

## Current Non-Goals

- No stadium
- No crowd
- No imported assets
- No throwing
- No loose-ball physics
- No offensive linemen rules
- No holding penalties
- No pancake blocks
- No double-team blocks
- No pulling guards
- No diving tackles
- No tackling animations
- No passing
- No pathfinding library
- No sprinting
- No animation
- No quarters
- No game clock
- No play clock
- No punts
- No field goals
- No penalties
- No defensive possessions
- No celebration animation
- No stadium presentation
- No center or snap animation
- No full game rules
- No menus
- No force-based physics
- No ragdoll physics
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
- All gameplay players use the common player model with stable ID, team, role, position, velocity, facing, collision radius, and current state.
- Initial formations belong in data, not hard-coded mesh positions.
- The gameplay model owns player position, velocity, facing, and blocking engagement state; Three.js meshes only display that state.
- The gameplay model owns play state and ball possession; the ball mesh is never authoritative.
- The gameplay model owns play results, start spots, dead-ball spots, yards gained, and scoring team data; UI and meshes only display that state.
- Drive and down rules belong in a dedicated model, not renderer or HUD code.
- Keep conversion between world units and football yards centralized.
- Goal-line detection and scoring must use gameplay coordinates, not mesh positions.
- Sideline and dead-ball spotting must use gameplay coordinates, not mesh positions.
- Defender AI must use gameplay positions and stay deliberately simple.
- Blocking is deterministic gameplay state, not force-based physics.
- Tackling must use explicit configurable collision radii.
- Preserve the fixed three-quarter gameplay camera unless the user asks for a camera system.
- Handle browser resizing whenever camera or renderer code changes.
- Keep renderer choices isolated enough that WebGPU can be added without rewriting gameplay scene construction.
- Add or update browser smoke coverage when scene startup, camera framing, renderer boot, resize behavior, controls, or play state changes.

## Done Criteria For This Milestone

- The project builds and launches without console errors.
- Three offensive and three defensive players appear in formation without initial overlap.
- All players remain stationary before the snap.
- On the snap, the runner becomes user-controlled, blockers move toward lanes, and defenders pursue the runner.
- Blockers can engage one defender each, engaged defenders are impeded, and engagements can end after separation.
- Circle-based gameplay collision prevents players from occupying the exact same position.
- The runner can score or be tackled.
- Assignment, engagement, disengagement, separation, and tackle detection have deterministic tests.
- Existing tests pass.
- The browser smoke test proves formation, movement, score, tackle, out-of-bounds, and turnover-on-downs outcomes work.
