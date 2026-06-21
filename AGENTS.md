# AGENTS.md

## Project

This repository is a low-poly 3D American football game prototype built with Three.js, Vite, TypeScript, WebGL, and a future WebGPU path. The current milestone is a one-defender rushing drill with a controllable primitive ball carrier, one simple pursuing defender, a basic offensive drive, downs, yards-to-go, touchdown scoring, tackle and out-of-bounds outcomes, turnover-on-downs reset, dead-ball spotting, signed yardage, moving line of scrimmage, first-down marker, and delayed reset.

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
- No quarters
- No game clock
- No play clock
- No punts
- No field goals
- No penalties
- No defensive possessions
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
- Drive and down rules belong in a dedicated model, not renderer or HUD code.
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
- The drive starts at first-and-10 and tracks current down, yards to go, line of scrimmage, and first-down marker.
- Non-touchdown play results update down and distance exactly once.
- Reaching the line to gain awards a new first-and-10.
- Failed fourth down shows `TURNOVER ON DOWNS`, marks the drive over, and resets a new offensive drill from the configured start.
- Touchdowns keep the existing score/message timing and reset the next drive to first-and-10.
- The HUD shows down, distance, ball position, and score.
- The field draws visible line-of-scrimmage and first-down lines.
- Drive-rule transitions have deterministic tests.
- Existing tests pass.
- The browser smoke test proves score, tackle, out-of-bounds, and turnover-on-downs outcomes work.
