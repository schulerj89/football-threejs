# AGENTS.md

## Project

This repository is a low-poly 3D American football game prototype built with Three.js, Vite, TypeScript, WebGL, and a future WebGPU path. The current milestone is a two-minute three-on-three offensive score-attack drill with two data-defined rushing plays, Quick Pass, Slant Flat, primitive player bodies with cloned low-poly helmet visuals, a controllable primitive ball carrier or scrambling quarterback, selected eligible receivers on pass plays, AI blockers, AI defenders, deterministic blocking engagements, pass rush, sack classification, a deterministic passing arc, per-play forward-pass eligibility, explicit ball states, a basic offensive drive, downs, yards-to-go, touchdown scoring, sack, tackle, incomplete, and out-of-bounds outcomes, turnover-on-downs reset, dead-ball spotting, signed yardage, moving line of scrimmage, first-down marker, final-score game over, and delayed reset.

## Current Non-Goals

- No stadium
- No crowd
- No imported assets beyond the current reusable low-poly helmet
- No loose-ball physics
- No large play-calling menu
- No audibles
- No defensive play selection
- No interceptions
- No four-on-four
- No manual aiming
- No hot routes
- No bullet/lob selection
- No pump fake
- No illegal-forward-pass penalty
- No referee logic
- No scramble animation
- No blitz selection
- No user-controlled catch mechanic
- No contested-catch ratings
- No quarterback animations
- No route editor
- No procedural play generation
- No additional formations beyond the current four plays
- No offensive linemen rules
- No holding penalties
- No pancake blocks
- No double-team blocks
- No pulling guards
- No diving tackles
- No tackling animations
- No pathfinding library
- No sprinting
- No animation
- No quarters
- No opponent score
- No halftime
- No timeouts
- No NFL clock-stoppage rules
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
- Play definitions belong in data and must stay independent from Three.js scene objects.
- Play selection is allowed during pre-snap only; resetting preserves the selected play.
- The gameplay model owns player position, velocity, facing, and blocking engagement state; Three.js meshes only display that state.
- The gameplay model owns play state, ball possession, pass state, and pass flight data; the ball mesh is never authoritative.
- The gameplay model owns play results, start spots, dead-ball spots, yards gained, and scoring team data; UI and meshes only display that state.
- Drive and down rules belong in a dedicated model, not renderer or HUD code.
- Score-attack clock rules belong in a dedicated model and must use supplied delta time rather than wall-clock reads.
- Keep conversion between world units and football yards centralized.
- Goal-line detection and scoring must use gameplay coordinates, not mesh positions.
- Sideline and dead-ball spotting must use gameplay coordinates, not mesh positions.
- AI-controlled non-carriers should remain inside playable field bounds; only the active ball carrier may cross a sideline to create an out-of-bounds result.
- Defender AI must use gameplay positions and stay deliberately simple.
- Blocking is deterministic gameplay state, not force-based physics.
- Passing uses deterministic gameplay state and a controlled arc, not a general-purpose physics engine.
- Passing play definitions use ordered eligible receiver IDs; selected receiver state belongs to the gameplay model, not the HUD or mesh layer.
- Imported player art should remain visual-only; gameplay collision stays in the gameplay player model and primitive body replacements are out of scope unless requested.
- Repeated GLB assets should be loaded once and cloned or instanced, with material clones created before team-specific tinting.
- Forward-pass eligibility is gameplay state reset per play; crossing the original line of scrimmage disables it permanently for that play using the documented epsilon in `src/passRules.ts`.
- Sack classification belongs in gameplay rules and must depend on possession, pass attempt state, line of scrimmage, and defender contact.
- Tackling must use explicit configurable collision radii.
- Preserve the fixed three-quarter gameplay camera unless the user asks for a camera system.
- Handle browser resizing whenever camera or renderer code changes.
- Keep renderer choices isolated enough that WebGPU can be added without rewriting gameplay scene construction.
- Add or update browser smoke coverage when scene startup, camera framing, renderer boot, resize behavior, controls, or play state changes.

## Done Criteria For This Milestone

- The project builds and launches without console errors.
- Inside Run, Outside Run, Quick Pass, and Slant Flat can be selected before the snap.
- Each play has a stable ID, display name, formation, ball-carrier role, initial direction, and blocker lane or route data.
- Selecting a play resets players into valid positions and visibly changes formation or blocking direction.
- Selection cannot change during live play.
- Reset preserves the current selected play.
- Rushing plays work with downs, yardage, tackles, touchdowns, and resets.
- Passing plays work with quarterback possession, scrambling, line-of-scrimmage pass eligibility, pass rush, sacks before throws, route-running receivers, deterministic target selection, one pass attempt, catch transfer, incompletions, completed-pass yardage, tackles, touchdowns, and resets.
- Score attack starts at 120 seconds, begins on the first snap, ticks continuously after that, allows a live play to finish at zero, prevents another snap after expiry, records final score, and restarts from game over with Enter.
- The low-poly helmet GLB loads once, clones to every player, attaches to the player head anchor, tints shell colors by team, and leaves gameplay collision unchanged.
- Play lookup, formation placement, invalid IDs, selection restrictions, pass eligibility, rejected throws, pass transitions, catch eligibility, incomplete passes, sacks, selected-target cycling, control transfer, and duplicate throw prevention have deterministic tests.
- Existing tests pass.
- The browser smoke test proves play selection plus formation, movement, score, tackle, out-of-bounds, and turnover-on-downs outcomes work.
