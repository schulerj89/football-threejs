# AGENTS.md

## Project

This repository is a low-poly 3D American football game prototype built with Three.js, Vite, TypeScript, WebGL, and a future WebGPU path. The current milestone is a two-minute five-on-five offensive score-attack drill with semantic data-defined formations for Inside Run, Outside Run, Quick Pass, and Slant Flat, graphical pre-snap SVG play cards generated from gameplay play data, primitive player bodies with cloned low-poly helmet visuals, a field generated from a pure field specification with batched static markings and presentation-only turf/yard-number/goalpost/sideline elements, a controllable primitive ball carrier or scrambling quarterback, selected eligible receivers on pass plays, AI blockers, AI defenders, deterministic blocking engagements, pass rush, sack classification, a deterministic passing arc, per-play forward-pass eligibility, explicit ball states, a basic offensive drive, downs, yards-to-go, touchdown scoring, sack, tackle, incomplete, and out-of-bounds outcomes, turnover-on-downs reset, exact dead-ball spotting with three-lane snap placement, signed yardage, moving line of scrimmage, first-down marker, final-score game over, delayed reset, a preserved tactical orthographic camera, and an optional behind-the-offense perspective camera.

## Current Non-Goals

- Presentation: no stadium, crowd, stadium seating, sideline characters, advertisements, weather, field degradation, turf redesign, or stadium presentation.
- Roster scope: no 7v7, 11v11, full special teams, additional offensive or defensive players beyond the current five-on-five drill, player switching, or formations beyond the current Inside Run, Outside Run, Quick Pass, and Slant Flat play data.
- Assets and animation: no imported assets beyond the current reusable low-poly helmet, no full player models replacing primitive bodies, no imported animations, no quarterback animation, no scramble animation, no tackling animation, no celebration animation, and no center or snap animation.
- Play calling: no large playbook menu, title screen, audibles, defensive play selection, route editor, procedural play generation, hot routes, or menus beyond the current pre-snap play cards and minimal HUD/debug displays.
- Passing and ball outcomes: no interceptions, fumbles, loose-ball physics, manual aiming, pass-type selection, pump fake, illegal-forward-pass penalty, referee logic, user-controlled catch mechanic, contested-catch ratings, or quarterback ratings.
- Blocking and tackling: no offensive linemen rules, holding penalties, pancake blocks, double-team blocks, pulling guards, diving tackles, advanced pursuit/pathfinding library, or physics-driven contact.
- Game structure: no quarters, opponent score, halftime, timeouts, NFL clock-stoppage rules, play clock, punts, field goals, penalties, defensive possessions, full game rules, season modes, or franchise systems.
- Controls and camera: no sprinting, stamina, freely rotating camera, camera-relative controls, cinematic replay system, or camera redesign beyond the current tactical and offense-perspective modes.
- Simulation architecture: no force-based physics, ragdoll physics, general-purpose physics engine, advanced AI rewrite, or unrelated refactoring.

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
- Keep authoritative field dimensions, paint widths, playable bounds, field bounds, and plain field layout data in `src/fieldSpec.ts`.
- `src/fieldSpec.ts` must stay free of Three.js imports.
- Generate rendered field-marking dimensions and positions from the field spec rather than repeating raw field dimensions in renderer code.
- Keep painted field markings fully inside the field surface; boundary paint outer edges should align with field outer edges, and transverse internal markings should stop at the inner sideline paint edges.
- Batch static field markings by shared material where practical; keep line of scrimmage, first-down line, and play-direction marker separate because they are dynamic.
- Field presentation meshes such as turf bands, yard numbers, goalposts, sideline apron, team boxes, and surrounding ground must remain presentation-only and must not influence collision, spotting, scoring, or boundaries.
- Keep yard numbers sideline-oriented and goalposts on the end lines at the back of the end zones.
- Painted hash marks and ball-spotting snap lanes must use the same authoritative hash X value from `src/fieldSpec.ts`.
- Use primitive Three.js geometry and simple materials during graybox work.
- Keep input, simulation, and visual synchronization in separate modules.
- All gameplay players use the common player model with stable ID, team, role, position, velocity, facing, collision radius, and current state.
- Current formations use the stable 10-player roster: `offense-qb`, `offense-rb`, `offense-blocker-left`, `offense-blocker-right`, `offense-wr`, `defense-rusher-left`, `defense-rusher-right`, `defense-cover-wr`, `defense-cover-rb`, and `defense-safety`.
- Initial formations belong in semantic data resolved through `src/formationLayout.ts`, not hard-coded mesh positions or independent per-play clamps.
- Formation data should separate formation position, pre-snap facing, post-snap movement direction, blocking targets, route targets, and coverage assignments.
- Play definitions belong in data and must stay independent from Three.js scene objects.
- Play-call card diagrams must be generated from `PlayDefinition`, resolved formation, route targets, and blocker targets; do not maintain separate diagram coordinates.
- SVG play-card coordinate mapping belongs in pure transformation code and should not mutate gameplay state.
- Pointer/tap play-card selection must feed into the same request path as keyboard play selection; DOM event handlers must not directly mutate the gameplay model.
- Play selection is allowed during pre-snap only; resetting preserves the selected play.
- The gameplay model owns player position, velocity, facing, and blocking engagement state; Three.js meshes only display that state.
- The gameplay model owns play state, ball possession, pass state, and pass flight data; the ball mesh is never authoritative.
- The gameplay model owns play results, start spots, exact dead-ball spots, normalized next snap spots, snap lanes, yards gained, and scoring team data; UI and meshes only display that state.
- Never use the exact dead-ball X coordinate as the next formation origin; resolve the next snap to left hash, middle, or right hash through `src/ballSpotting.ts`.
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
- Preserve the tactical orthographic gameplay camera for comparison and debugging.
- Keep camera behavior in a dedicated camera controller that reads gameplay snapshots and never mutates gameplay state.
- Calculate camera offsets relative to the configured direction of play rather than scattering hard-coded field-axis assumptions.
- Preserve field-relative movement controls unless camera-relative controls are explicitly requested.
- Handle browser resizing whenever camera or renderer code changes.
- Keep renderer choices isolated enough that WebGPU can be added without rewriting gameplay scene construction.
- Add or update browser smoke coverage when scene startup, camera framing, renderer boot, resize behavior, controls, or play state changes.

## Done Criteria For This Milestone

- The project builds and launches without console errors.
- Inside Run, Outside Run, Quick Pass, and Slant Flat can be selected before the snap.
- The pre-snap play-call UI renders one SVG card per available offensive play and hides during live/dead play.
- Play-card diagrams show play name, line of scrimmage, ball, offensive formation, run direction or receiver routes, and blocker assignments from gameplay data.
- The selected play card is visually highlighted, pointer/tap selection works, and number-key shortcuts remain available.
- Each play has a stable ID, display name, formation, ball-carrier role, initial direction, and blocker lane or route data.
- Selecting a play resets players into valid positions and visibly changes formation or blocking direction.
- Selection cannot change during live play.
- Reset preserves the current selected play.
- Rushing plays work with downs, yardage, tackles, touchdowns, and resets.
- Passing plays work with quarterback possession, scrambling, line-of-scrimmage pass eligibility, pass rush, sacks before throws, route-running receivers, deterministic target selection, one pass attempt, catch transfer, incompletions, completed-pass yardage, tackles, touchdowns, and resets.
- Score attack starts at 120 seconds, begins on the first snap, ticks continuously after that, allows a live play to finish at zero, prevents another snap after expiry, records final score, and restarts from game over with Enter.
- The low-poly helmet GLB loads once, clones to every player, attaches to the player head anchor, tints shell colors by team, and leaves gameplay collision unchanged.
- The tactical orthographic camera and optional offense perspective camera can both render, resize, and be compared through URL selection or the development/debug `C` toggle without resetting gameplay.
- Field dimensions and painted-line containment are validated through pure layout tests plus a Three.js `Box3` integration test.
- Static field markings are batched into a small bounded set of draw calls, and the browser smoke test checks the debug-overlay renderer call budget.
- Play lookup, formation placement, invalid IDs, selection restrictions, pass eligibility, rejected throws, pass transitions, catch eligibility, incomplete passes, sacks, selected-target cycling, control transfer, and duplicate throw prevention have deterministic tests.
- Existing tests pass.
- The browser smoke test proves play selection plus five-on-five formation, movement, score, tackle, out-of-bounds, and turnover-on-downs outcomes work.
