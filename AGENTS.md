# AGENTS.md

## Project

This repository is a low-poly 3D American football game prototype built with Three.js, Vite, TypeScript, WebGL, and a future WebGPU path. The current milestone is a graybox field scene with one controllable primitive placeholder player.

## Current Non-Goals

- No stadium
- No crowd
- No imported assets
- No ball behaviour
- No defender
- No sprinting
- No animation
- No AI
- No scoring
- No game rules
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
- Preserve the fixed three-quarter gameplay camera unless the user asks for a camera system.
- Handle browser resizing whenever camera or renderer code changes.
- Keep renderer choices isolated enough that WebGPU can be added without rewriting gameplay scene construction.
- Add or update browser smoke coverage when scene startup, camera framing, renderer boot, or resize behavior changes.

## Done Criteria For This Milestone

- The project builds and launches without console errors.
- The player moves in every direction through WASD and arrow keys.
- Diagonal speed equals horizontal and vertical speed.
- The player cannot leave the playable field.
- Movement behavior has focused automated tests.
- Existing tests pass.
- The browser smoke test proves the scene starts and keyboard movement works.
