# Changelog

All notable changes to this project will be documented in this file.

## [0.27.1] - 2026-06-21

### Fixed

- Replaced normal passing's fixed receiver lead heuristic with route-aware targeting that samples the selected receiver's declared route progress over predicted ball flight time.
- Added swept ball/receiver catch evaluation so catches remain deterministic when the ball crosses the catch corridor between frames.
- Added `?passAudit=1` pass diagnostics for release position, predicted target, predicted receiver location, flight time, closest approach, miss distance, catch height, and result reason.
- Added unit and browser coverage for route-aware prediction, slant and flat timing, hash-lane bounds, completed-route targets, swept catches, pass-audit reset, and 30/60/120 Hz pass-result consistency.

## [0.27.0] - 2026-06-21

### Added

- Added on-field receiver route art that renders eligible receiver paths before the snap from the same resolved route data used by receiver simulation.
- Added selected-receiver route highlighting, start markers, break markers, and route-end arrowheads above the turf.
- Added `?routeArt=0` / `?routeArt=1` route-art control and development-only `?routeAudit=1` route audit mode.
- Added route-audit measurements for active segment, route progress, completion percentage, nearest projected route point, and cross-track error.
- Added unit and browser coverage for route art visibility, selected-state rendering, route-audit math, mirrored hash-lane routes, and play-card multi-segment route geometry.

### Changed

- Graphical play cards now draw multi-segment receiver routes from resolved route points instead of a single line to the final target.

## [0.26.0] - 2026-06-21

### Added

- Added pure `src/receiverRoutes.ts` route math for ordered receiver-route waypoints, segment lengths, cumulative distance, sampling, tangents, projection, cross-track error, and deterministic route-state advancement.
- Added gameplay-owned receiver route state so route progress, active segment, and completion reset with play selection, snap, reset, and challenge restart.
- Added multi-segment route definitions for Quick Pass, Slant, and Flat while preserving current final pass destinations.
- Added configurable route recovery speed so receivers can recover toward the active route segment after collision separation without moving route progress backward.
- Added focused unit coverage for route resolution, waypoint order, route sampling, segment math, frame-rate independent progress, route mirroring, waypoint bounds, reset behavior, and catch-control transfer.

### Changed

- Receiver AI now follows sampled route paths in order instead of steering directly at one final target.

## [0.25.0] - 2026-06-21

### Added

- Added optional playable `?playbook=7v7` mode with the new `Twin Slants Flat` passing play.
- Added three ordered eligible receivers, readable target names, data-defined twin slant and running-back flat routes, explicit pass-protection assignments, explicit coverage assignments, and safety deep-help data for the 7v7 pass.
- Added roster/playbook metadata for play definitions and shared 5v5/7v7 stable roster ID modules.
- Added unit and browser smoke coverage for 7v7 receiver cycling, route starts, protection assignments, coverage validity, safety midpoint alignment, throwing to each target, catch transfer, incompletion, sack classification, post-release contact, reset behavior, play-card rendering, and the playable 7v7 browser path.

### Changed

- Made number-key play selection and pre-snap play cards derive from the active playbook, preserving the existing 5v5 default controls while allowing `1` to select `Twin Slants Flat` in 7v7 mode.
- Updated defender AI so pass protectors prefer explicit rusher assignments and coverage defenders switch to carrier pursuit after a completed pass.

## [0.24.1] - 2026-06-21

### Added

- Added development-only `?presentationAudit=1` for validating 7v7 presentation grounding, helmet attachment, helmet-to-shoulder gaps, root transform stability, NDC player-bound framing, and render metrics.
- Added `?presentationState=locomotion` plus audit hotkeys `L` and `P` for presentation-only locomotion and pre-snap audit states without adding 7v7 gameplay behavior.
- Added unit and browser smoke coverage for audit formations, 300-frame pre-snap root stability, helmet parenting, neutral disabled-motion poses, visual-bound camera containment, and required screenshot scenarios.

### Fixed

- Lifted the mannequin helmet anchor slightly and reduced procedural torso/limb pose extremes to preserve a stable helmet-to-shoulder gap.
- Added visual-only locomotion foot lift so procedural stride poses keep feet and body geometry on or above field level.
- Held cinematic pre-snap establish framing in presentation audit mode and reset presentation framing after 7v7 preview lane changes.

## [0.24.0] - 2026-06-21

### Added

- Added optional `cinematicBroadcast` camera mode, selectable with `?camera=cinematic`.
- Added `PresentationCameraDirector` for snapshot-driven pre-snap establishing, transition, live-carrier, pass-flight, dead-ball, touchdown, and return-to-pre-snap presentation phases.
- Added cinematic camera debug output for presentation phase, focus target, formation bounds, camera position, and look target.
- Added unit coverage for formation bounds, snap immediacy, catch-transfer smoothing, dead-ball and touchdown focus, reset focus, snapshot immutability, camera mode cycling, and resize handling.
- Added browser smoke coverage for cinematic URL selection, snap immediacy, live-carrier phase, debug output, and 7v7 preview framing.

### Changed

- Expanded the development camera toggle to cycle through tactical orthographic, offense perspective, and cinematic broadcast modes.
- Documented the cinematic camera controls and presentation-camera implementation boundaries in README and AGENTS.

## [0.23.0] - 2026-06-21

### Added

- Added development-only `?formationPreview=7v7` staging mode with fourteen stable player IDs, semantic formation resolution, mannequin bodies, and cloned helmets.
- Added left-hash, middle, and right-hash preview lane controls with `1`, `2`, and `3`.
- Added a 7v7 preview formation contract that validates seven players per team, stable IDs, clearance, legal sides, offensive-line spacing, receiver sideline insets, declared defensive gaps, and coverage alignment.
- Added debug/test render metrics for frame time, scene/player mesh counts, material counts, geometry count, texture count, draw calls, and triangles.
- Added unit and browser smoke coverage for 7v7 preview resolution, lane mirroring, defensive references, camera containment, idle preview behavior, helmet attachment, and render metrics.

### Changed

- Extended formation validation to support explicit roster contracts while preserving the existing five-on-five validation defaults.
- Updated README and AGENTS to describe the static 7v7 preview as a development capability, not active 7v7 gameplay.

## [0.22.0] - 2026-06-21

### Added

- Added a visual-only `PlayerPoseController` presentation layer for low-poly mannequin ready stances and locomotion.
- Added offensive and defensive pre-snap pose intents, locomotion intent derivation, deterministic per-player phase offsets, distance-driven stride phase, transition smoothing, and frame-delta clamping.
- Added `?playerMotion=0` to disable procedural player motion for comparison.
- Added `?poseDebug=1` to display every player's current pose intent and locomotion phase.
- Added focused unit coverage for pose intent selection, stride-rate consistency, deterministic phase offsets, locomotion phase opposition, disabled motion, and gameplay snapshot immutability.
- Added browser smoke coverage for pose-debug output, pre-snap pose intents, locomotion during movement, and disabled motion mode.

### Changed

- Documented the visual-only player motion options in README and updated AGENTS implementation rules for pose-controller ownership.

## [0.21.1] - 2026-06-21

### Fixed

- Calibrated the procedural low-poly player mannequin proportions by lowering and narrowing the shoulder/body stack, centering the head anchor, and reducing helmet scale through shared visual configuration.
- Fixed helmet placement so the helmet no longer intersects the shoulder pads while preserving the existing GLB load-once, clone, and team-material tinting path.
- Kept mannequin feet at field level and expanded validation for equal player bounds, mirrored limbs, body ground clearance, helmet bounds, body materials, and body geometry sharing.
- Avoided per-frame body `Box3` measurement work when the debug overlay is hidden.

### Changed

- Expanded player-body debug measurements to include combined helmet/body bounds, helmet bounds, helmet-to-shoulder gap, minimum body Y, unique body geometry count, and unique body material count.

## [0.21.0] - 2026-06-21

### Added

- Added a procedural low-poly football-player mannequin body with torso, shoulder pads, arm pivots, leg pivots, feet, and the existing helmet head anchor.
- Added `?playerBody=box` / `?playerBody=mannequin` comparison support and `?debugRoleColors=1` for role-color visual debugging.
- Added player body debug measurements for style, configured height, shoulder width, body bounds, body triangle count, and body mesh count.
- Added unit and browser smoke coverage for mannequin hierarchy, shared geometry, team colors, debug role colors, body budget, helmet-anchor preservation, and the box comparison mode.

### Changed

- Updated README and AGENTS to describe the long-term low-poly 11v11 target, cinematic/broadcast presentation direction, and current silhouette milestone.
- Reframed stadium, crowd, animation, and larger formations as deferred future scope instead of permanent non-goals.
- Replaced the default rectangular player body with the low-poly mannequin while preserving gameplay-owned position, facing, collision, AI, possession, and helmet recoloring.

## [0.20.0] - 2026-06-21

### Added

- Added a graphical pre-snap play-call UI with one responsive SVG card for every available offensive play.
- Generated play-card diagrams from existing play definitions, resolved formation positions, receiver route targets, blocker targets, and snap placement.
- Added pure football-coordinate to SVG-coordinate transformation for play-card diagrams.
- Added pointer/tap play selection through the same request path as keyboard number shortcuts.
- Added unit and browser smoke coverage for play-card rendering, route counts, run arrows, selected-card highlighting, live-play hiding, pointer selection, and number-key selection.

### Fixed

- Mirrored play-card lateral presentation so pass-route arrows match the gameplay camera direction.

## [0.19.0] - 2026-06-21

### Added

- Expanded the current offensive drill to a stable five-on-five roster across Inside Run, Outside Run, Quick Pass, and Slant Flat.
- Added pure semantic formation resolution in `src/formationLayout.ts` with hash-aware field/boundary side placement, stable player IDs, assignment validation, and no Three.js dependency.
- Added `?formationAudit=1` to display resolved formation positions, offsets, sides, and validation issues during development.
- Added unit coverage for 5v5 formation resolution, roster validation, hash-side mirroring, rusher alignment, coverage alignment, safety midpoint placement, and invalid formations.

### Changed

- Converted play definitions from raw offset placement to semantic formation slots and route/blocking targets.
- Updated gameplay start-state handling so unrouted offensive receivers stay idle before and after the snap until their play defines a route.
- Updated browser smoke coverage for five-on-five roster creation, helmet attachment, play selection, passing, rushing, tackle, out-of-bounds, turnover, and audit-overlay startup.

## [0.18.2] - 2026-06-21

### Changed

- Reorganized README and AGENTS non-goals around the current 3v3 score-attack prototype scope.
- Clarified current exclusions for roster size, play calling, passing outcomes, game structure, camera controls, assets, animation, and simulation architecture.

## [0.18.1] - 2026-06-21

### Added

- Added pure ball-spotting rules that resolve exact dead-ball spots to `leftHash`, `middle`, or `rightHash` snap lanes.
- Added debug-overlay readouts for exact dead-ball spot, resolved next snap spot, snap lane, hash X positions, and formation origin.
- Added deterministic tests for snap lane selection, incomplete-pass lane preservation, touchdown reset spotting, exact yardage, and formation-origin reset.

### Changed

- Normalized next-play formation origins to widened arcade hash lanes while preserving exact play-result spots for yardage and forward progress.
- Derived painted hash-mark positions and spotting lanes from the same field-spec hash X value.

## [0.18.0] - 2026-06-21

### Added

- Added presentation-only alternating five-yard turf bands, yard numbers, goalposts, sideline apron, team-box boundaries, and surrounding ground plane.
- Added batched static field-marking meshes grouped by material while keeping line of scrimmage, first-down line, and play-direction marker dynamic.
- Added shared batched geometry helpers for static field presentation primitives.
- Added browser smoke coverage for the reduced renderer draw-call budget.

### Changed

- Reduced baseline tactical debug-overlay renderer calls from `284` to `72` while preserving gameplay field coordinates and drive-line logic.
- Kept static hashes and yard lines out of independent per-marking mesh draw calls.
- Moved goalposts to the end lines at the back of each end zone, corrected sideline-facing yard number orientation, and increased two-digit yard-number spacing.

## [0.17.0] - 2026-06-21

### Added

- Added pure `src/fieldSpec.ts` as the authoritative source for field scale, dimensions, paint widths, field bounds, playable bounds, and plain field-layout data.
- Added field-layout validation that checks marking bounds without constructing Three.js scene objects.
- Added `?fieldAudit=1` development overlay with field bounds, inner marking bounds, corner markers, and red highlighting for any out-of-bounds marking.
- Added unit coverage for field dimensions, end-zone depth, goal-line distance, yard-line spacing, hash spacing, boundary symmetry, paint containment, and yard/world conversion.
- Added a Three.js field-geometry integration test that validates painted-line mesh `Box3` world bounds stay inside the field surface.

### Fixed

- Inset sideline and end-line paint so boundary outer edges align with the field surface instead of extending beyond it.
- Stopped yard lines, goal lines, line-of-scrimmage, and first-down line at the inner sideline paint edges.
- Removed the extra `fieldWidth + 1.5` sizing from dynamic drive lines.

## [0.16.0] - 2026-06-21

### Added

- Added `src/camera/GameplayCameraController.ts` to own gameplay camera behavior outside `main.ts`.
- Added a selectable `offensePerspective` camera alongside the existing `tacticalOrthographic` camera.
- Added `?camera=tactical` and `?camera=offense` URL selection plus a development/debug `C` camera toggle.
- Added perspective camera framing for pre-snap formations, live ball carriers, in-flight passes, dead-ball spots, and reset returns to the new line of scrimmage.
- Added configurable perspective camera field of view, height, behind-distance, look-ahead, smoothing, and field-position bounds.
- Added camera mode/state/focus/position data to the optional debug overlay and debug snapshot API.
- Added unit and browser smoke coverage for camera mode selection, toggling, resize behavior, and pass-flight tracking.

## [0.15.0] - 2026-06-21

### Added

- Integrated `low_poly_helmet.glb` into the existing primitive player visual without replacing the primitive body.
- Added a reusable helmet loader that loads the GLB once, clones it for each player, and attaches clones to the player head anchor.
- Added name-based shell and faceguard mesh/material lookup with per-team cloned materials before tinting.
- Added configurable helmet position, rotation, and scale offsets plus independent shell and faceguard colors.
- Added helmet asset debug snapshot coverage and browser smoke validation that the asset loads and attaches to all players.
- Added focused tests for player head anchors, helmet part lookup, and per-team material cloning.

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
