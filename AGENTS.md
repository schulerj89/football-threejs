# AGENTS.md

## Project

This repository is a low-poly 3D American football game prototype built with Three.js, Vite, TypeScript, WebGL, and a future WebGPU path. The long-term target is a stylized low-poly 11v11 American-football game with cinematic and broadcast-style presentation. The current score-attack mode is a temporary gameplay test harness, not the final product identity. The current milestone adds a development-only static 7v7 formation preview while preserving the active five-on-five playable drill.

The active playable prototype is a two-minute five-on-five offensive score-attack drill with semantic data-defined formations for Inside Run, Outside Run, Quick Pass, and Slant Flat, graphical pre-snap SVG play cards generated from gameplay play data, low-poly procedural player bodies with cloned low-poly helmet visuals, visual-only procedural poses and locomotion, a field generated from a pure field specification with batched static markings and presentation-only turf/yard-number/goalpost/sideline elements, a controllable ball carrier or scrambling quarterback, selected eligible receivers on pass plays, AI blockers, AI defenders, deterministic blocking engagements, pass rush, sack classification, a deterministic passing arc, per-play forward-pass eligibility, explicit ball states, a basic offensive drive, downs, yards-to-go, touchdown scoring, sack, tackle, incomplete, and out-of-bounds outcomes, turnover-on-downs reset, exact dead-ball spotting with three-lane snap placement, signed yardage, moving line of scrimmage, first-down marker, final-score game over, delayed reset, a preserved tactical orthographic camera, and an optional behind-the-offense perspective camera. The `?formationPreview=7v7` mode is a static development staging tool for fourteen-player formation validation, rendering, and camera framing; it must not run AI or begin a live play.

## Current Non-Goals And Future Scope

- Presentation future scope: stadium, crowd, stadium seating, sideline characters, advertisements, weather, field degradation, turf redesign, and broader stadium presentation are deferred product work, not permanent exclusions.
- Roster future scope: active 7v7 play, 11v11, full special teams, additional offensive or defensive gameplay players beyond the current five-on-five drill, player switching, and formations beyond the current Inside Run, Outside Run, Quick Pass, Slant Flat, and static 7v7 preview data are deferred.
- Assets and animation future scope: imported full-body player models, skeletal animation, quarterback animation, scramble animation, tackling animation, celebration animation, and center or snap animation are deferred. The current milestone intentionally uses procedural low-poly silhouettes plus the reusable low-poly helmet.
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
- The 7v7 preview roster uses fourteen stable IDs in `src/formationPreview.ts` and is development-only; do not make it the default playable mode until active 7v7 gameplay is explicitly requested.
- Initial formations belong in semantic data resolved through `src/formationLayout.ts`, not hard-coded mesh positions or independent per-play clamps.
- Formation preview positions must resolve through the semantic formation system for each snap lane and must fail validation rather than clamping invalid geometry.
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
- Imported player art and procedural player silhouettes must remain visual-only; gameplay collision stays in the gameplay player model.
- Player visuals should preserve the root object used by gameplay synchronization, keep the helmet attached through the stable head anchor, and expose comparison/debug URL options when replacing major placeholder geometry.
- Procedural player pose and locomotion belong in `src/presentation/PlayerPoseController.ts`; pose controllers may read gameplay snapshots and transform visual pivots but must never mutate gameplay state.
- Pose amplitudes, blend rates, stride rates, velocity thresholds, and frame-delta clamps belong in a single pose configuration object.
- Normal player body colors should emphasize team identity; role-specific body colors belong behind explicit debug options.
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
- `?formationPreview=7v7` renders exactly seven offensive and seven defensive mannequin players with stable IDs and cloned helmets.
- Left-hash, middle, and right-hash preview lanes resolve valid formations through semantic formation data.
- Offensive line spacing, receiver sideline insets, defensive gap alignment, corner coverage alignment, linebacker alignment, safety midpoint alignment, legal sides, clearance, and playable bounds are validated.
- Preview lane controls work with `1`, `2`, and `3`; Space must not start a play in preview mode.
- Both tactical orthographic and offense-perspective cameras frame the full static preview formation.
- Debug metrics include draw calls, triangles, frame time, mesh counts, material counts, geometry count, and texture count.
- Existing five-on-five gameplay, helmet, visual, unit, and browser smoke tests pass unchanged.
