# Changelog

All notable changes to this project will be documented in this file.

## [0.45.1] - 2026-06-21

### Added

- Added `src/elevenOnElevenAudit.ts` with a deterministic 11v11 hardening matrix covering both plays, three snap lanes, normal/mirrored formation side, tactical/offense/cinematic camera modes, off/brief cinematics, disabled/low crowd modes, enabled/disabled audio, and 30/60/120 Hz simulation rates.
- Added `?elevenAudit=1` overlay/readback plus browser reset-cycle tooling for 22-player roster counts, line/backfield legality, eligibility, assignments, route errors, overlaps, stale references, camera containment, draw calls, triangles, geometry/material counts, player and helmet visual counts, active audio nodes, presentation holds, camera shots, and crowd reaction state.
- Added unit and browser smoke coverage for 11v11 formation legality, mirrored-side validation, pre-snap stability, run-blocking assignment ownership, pass protection, coverage, route order, update-rate consistency, catch/incompletion/sack/tackle/out-of-bounds/first-down/touchdown/turnover results, 100 reset cycles, and 7v7 baseline comparison.

### Fixed

- Corrected the 11v11 hardening audit so Spread Quick 11's strong-safety slot coverage is not incorrectly judged by the static-preview strong-safety midpoint rule.
- Hardened the run-congestion validation to detect persistent trapping while allowing transient tackle-contact overlap at an authoritative result point.

## [0.45.0] - 2026-06-21

### Added

- Added the 11v11 `Spread Quick 11` passing play with five ordered eligible receivers, semantic multi-segment routes, explicit pass-protection assignments, explicit coverage assignments, deep safety help, route-aware target prediction, and generated play-card/field-route data.
- Added unit and browser smoke coverage for 22-player creation, five-receiver cycling, route starts, unique protection, valid coverage, deep-help alignment, throws to selected receivers, catch/control transfer, incompletion spotting, sack classification, post-release quarterback contact, reset cleanup, and explicit 7v7/5v5 regression access.

### Changed

- Promoted 11v11 to the normal default playbook for plain launch, broadcast/performance settings, fallback playbook resolution, and the title/setup flow, with Inside Zone 11 as the default selected play.
- Reclassified 7v7 as a maintained development regression mode and 5v5 as the legacy regression mode in README and AGENTS guidance.

## [0.44.0] - 2026-06-21

### Added

- Added the optional `?playbook=11v11` development playbook with the first playable twenty-two-player `Inside Zone 11` rushing play while preserving 7v7 as the default.
- Added 11v11 run-play data using `ELEVEN_ON_ELEVEN_ROSTER`, the validated static formation, running-back possession, quarterback decoy behavior, deterministic one-to-one blocking assignments, lane targets, and unblocked safeties.
- Added unit and browser smoke coverage for optional 11v11 playbook selection, twenty-two-player creation, 11-per-team counts, RB possession, reset restoration, snap lanes, blocking assignments, tackle, first-down, touchdown, out-of-bounds, play-card generation, and browser rendering.

### Changed

- Extended playbook settings and query override handling to accept `11v11` without promoting it to the normal default.
- Updated README and AGENTS to document the optional Inside Zone 11 development path and keep broader 11v11 passing/additional-play work in future scope.

## [0.43.0] - 2026-06-21

### Added

- Added 11v11 roster constants and static development formation staging with `ELEVEN_ON_ELEVEN_ROSTER`, stable twenty-two-player IDs, and football-position metadata separate from gameplay roles.
- Added `src/elevenOnElevenFormation.ts` with named formation measurements, semantic 11v11 position resolution, eligibility metadata, line/backfield validation, corner alignment, safety-threat midpoint validation, and clear failure instead of clamping invalid geometry.
- Added `?formationPreview=11v11` with all twenty-two mannequins and helmets, left/middle/right snap-lane controls, preferred-side mirroring on `4`, formation audit labels, and tactical/offense/cinematic camera framing.
- Added unit and browser smoke coverage for 11v11 snap lanes, mirroring, line/backfield counts, eligibility, corner/safety alignment, no overlaps, static preview behavior, resource counters, and camera containment.

### Changed

- Extended formation preview snapshots and audit output with football position, line/backfield status, eligibility, distance from snap, distance from the line of scrimmage, and preferred formation side while preserving 7v7 as the default playable mode.
- Updated README and AGENTS to describe 11v11 as static development staging and keep active 11v11 gameplay in future scope.

## [0.42.1] - 2026-06-21

### Added

- Added a deterministic 7v7 hardening matrix covering four plays, three snap lanes, tactical/offense/cinematic camera modes, off/brief cinematics, disabled/low crowd modes, and 30/60/120 Hz simulation rates.
- Added `src/sevenOnSevenAudit.ts` with `?sevenAudit=1` overlay/readback for active play, snap lane, roster count, assignments, route corridor errors, stale engagements, overlap warnings, presentation events, and resource counters.
- Added browser smoke coverage for the seven-audit overlay and 100 snap/reset cycles to verify active player roots, visual roots, geometry/material counts, audio nodes, and presentation history remain bounded.

### Changed

- Extended unit coverage for 7v7 pre-snap stability, run assignments, pass routes/protection/coverage, update-rate consistency, reset cleanup, and tackle/sack/catch/incomplete/out-of-bounds/first-down/touchdown/turnover result paths.
- Documented 7v7 audit usage and patch-level hardening criteria.

## [0.42.0] - 2026-06-21

### Added

- Added `GamePresentationRuntime` to own the authoritative immutable presentation-event stream and feed the same events to gameplay audio, commentary, crowd visuals, presentation holds, and camera presentation.
- Added explicit presentation event precedence so touchdown, turnover, sack, first-down, incomplete/out-of-bounds, and ordinary tackle outcomes coordinate consistently.
- Added development integration history reporting emitted events, gameplay result identity, camera shot, crowd reaction/audio, announcer clip/caption, hold state, and reset completion.
- Added unit and browser smoke coverage for shared event delivery, precedence filtering, inactive presentation gating, and normal-game runtime event history.

### Changed

- `GameAudioDirector` can now consume pre-derived presentation events without making audio the owner of the presentation event stream.
- `main.ts` now routes page activity, skip behavior, crowd reactions, presentation holds, commentary, and camera event input through the shared runtime path.

## [0.41.0] - 2026-06-21

### Added

- Added 7v7 `Inside Zone 7`, `Outside Zone 7`, and `Quick Pass 7` plays alongside the existing `Twin Slants Flat` play, all using the stable fourteen-player roster and semantic formation data.
- Added explicit 7v7 run blocking, pass-protection, coverage, route, and possession data for the expanded playbook.
- Added unit and browser coverage for default 7v7 launch, all four 7v7 play cards, all snap lanes, receiver cycling, reset behavior, and explicit 5v5 regression access.

### Changed

- Promoted 7v7 to the default normal playbook for plain launches, broadcast/performance presets, setup UI, and fallback playbook resolution.
- Preserved 5v5 as an explicit legacy development and regression mode through `?playbook=5v5` and the title setup flow.
- Updated project docs to identify 7v7 as the active default mode and 11v11 as the next roster milestone.

## [0.40.0] - 2026-06-21

### Added

- Generated the approved local ElevenLabs prototype audio pack: two streamed crowd loops, six crowd reactions, seven football-event one-shots, 27 prototype announcer MP3 clips, three preserved voice previews, and provenance sidecars.
- Added `npm run audio:verify` to validate runtime-manifest paths, non-empty decodable files, duration bounds, provenance sidecars, caption/catalog consistency, compressed-size budget, decoded-buffer budget policy, readiness classification, and the audition page.
- Added `public/audio/audio-readiness.json`, `public/audio/audio-verification-report.json`, refreshed `public/audio/football-sfx-pack-report.json`, and a full `public/audio/audition-index.html` listing crowd, effects, announcer captions/prompts, duration, size, and generation metadata.

### Changed

- Bounded runtime decoded audio buffer caching with least-recently-used eviction and skipped known-missing optional assets without repeated fetch attempts.
- Updated README and AGENTS to reflect that the first runtime MP3 pack is generated and verified locally while ElevenLabs remains offline-only production tooling.

## [0.39.0] - 2026-06-21

### Added

- Added a player-facing title screen and setup flow so a normal launch starts from `Start Game` instead of immediately entering gameplay.
- Added a reusable game setup UI with presentation preset, game mode, and custom presentation controls for camera, cinematics, crowd visuals, crowd density, crowd reactions, master audio, crowd audio, announcer, and captions.
- Added a pre-snap/dead-ball pause settings panel opened with `Escape`, with immediate safe application for presentation and audio settings and a return-to-title path for game mode changes.
- Added app-phase gating so the score clock, gameplay AI, play controls, play cards, and presentation events do not advance behind the title screen or pause settings panel.
- Added title-screen loading/readiness states for helmets, optional audio unlock/readiness, and crowd initialization.
- Added persisted non-custom game mode settings so broadcast/performance selections can retain the selected 5v5 or limited 7v7 prototype across reloads.
- Added browser smoke coverage for title launch gating, Start Game audio unlock, broadcast/performance startup, 5v5/7v7 playbook selection, persisted title settings, and direct-query compatibility.

## [0.38.0] - 2026-06-21

### Added

- Added `src/config/GameExperienceSettings.ts` as the authoritative normal-game experience facade composing camera, cinematics, playbook, route art, player motion, crowd, audio, announcer, and caption settings.
- Added the default `broadcast` preset for plain launches: 5v5 playbook, offense camera, brief cinematics, low-density visual crowd, crowd reactions, runtime audio, crowd audio, announcer, route art, and player motion.
- Added a `performance` preset that keeps gameplay usable while disabling expensive visual presentation, plus persisted custom settings and non-persistent query overrides.
- Added debug readback for effective preset, persisted settings, query overrides, final resolved settings, development-only mode flags, and audio/crowd asset readiness.
- Added unit and browser smoke coverage for plain-launch broadcast defaults, performance behavior, custom persistence, query override precedence, and development-only audit/preview flags.

## [0.37.0] - 2026-06-21

### Added

- Added optional normal-game crowd visuals with persisted/query settings, benchmarked low/medium/high density presets, shared instanced spectator resources, and development overlay/audit snapshots.
- Added deterministic crowd reaction states for idle, anticipation, first down, touchdown, and disappointment using stable presentation event IDs, deterministic spectator subsets, and bounded low-frequency matrix updates.
- Added presentation hold coordination for full-cinematics post-play cutaways without changing authoritative gameplay results or default `cinematics=off` reset timing.
- Added full-cinematics first-down and touchdown fan cutaway shots through the existing `PresentationCameraDirector`, with touchdown cutaways chaining into the scorer orbit.
- Added a presentation hardening audit matrix reporting audio, announcer, captions, crowd visuals, crowd reactions, cinematics, active camera shot, presentation holds, duplicate suppression, render metrics, and audio memory counters.
- Added unit and browser smoke coverage for crowd settings, reaction dedupe, bounded crowd updates, presentation holds/skips, fan cutaways, audio-disabled crowd startup, and presentation audit output.

## [0.36.0] - 2026-06-21

### Added

- Added optional cinematic orbit-shot presentation with `?cinematics=off`, `?cinematics=brief`, and `?cinematics=full`, defaulting to `off` to preserve existing camera behavior.
- Added `prePlayOrbit180` formation setup shots that compute paths from play direction, formation bounds, field bounds, and aspect ratio without blocking snap input.
- Added `touchdownOrbit360` touchdown-result shots that start only after authoritative touchdown results, focus the scorer/dead-ball context, and remain skippable.
- Added `?shotPreview=prePlayOrbit180`, `?shotPreview=touchdownOrbit360`, and `?cameraDebug=1` diagnostics with shot name, progress, orbit center, radius, camera position, look target, and restore camera.
- Added unit and browser smoke coverage for shot triggering, skipping, camera restore, all snap lanes, resize-aware orbit paths, gameplay snapshot immutability, audio/caption continuity, and `off`/`brief`/`full` query modes.

## [0.35.0] - 2026-06-21

### Added

- Added a development-only `?crowdPreview=1` mode with a simple procedural seating shell, sideline and end-zone stands, and instanced low-poly spectators.
- Added deterministic spectator placement, shared geometry/material resources, near/far LOD tiers, and explicit per-instance memory estimates.
- Added crowd preview camera controls for wide, sideline, end-zone, and close inspection views.
- Added a crowd preview overlay and `?crowdBenchmark=1` sweep for 500, 2,000, 5,000, and 10,000 spectators reporting draw calls, triangles, resource counts, frame time, minimum observed FPS, and renderer counters.
- Added unit and browser smoke coverage for crowd count clamping, deterministic layouts, instancing/resource budgets, no active gameplay players in preview mode, disposal, camera controls, and benchmark output.

## [0.34.0] - 2026-06-21

### Added

- Added a runtime broadcast commentary director that consumes immutable presentation events, selects pre-rendered announcer clips by context, serializes speech playback, prevents immediate variant repetition, and applies per-category cooldowns.
- Added a runtime commentary catalog and optional local announcer assets to the audio manifest without adding any runtime ElevenLabs calls.
- Added priority handling so high-value commentary can cancel obsolete lower-priority queued lines, with touchdown commentary taking precedence over first-down commentary.
- Added crowd-bus ducking while announcer speech is active, with safe restoration on speech completion, mute, reset, and hidden-page suppression while preserving gameplay SFX.
- Added accessible optional broadcast captions, `?captions=1`, `?commentaryDebug=1`, and commentary state in the audio debug overlay.
- Added announcer on/off, announcer volume, and captions on/off settings/control hooks.
- Added deterministic unit coverage for priority suppression, no overlapping speech, variant repetition, cooldowns, crowd duck/restore, mute safety, caption/catalog matching, audio-disabled loading suppression, and snapshot immutability.

## [0.33.0] - 2026-06-21

### Added

- Added an original fictional prototype broadcast identity and a typed 27-line announcer script catalog covering game opening, play-ready, first down, touchdown, sack, tackle-for-loss, big-gain, incomplete, out-of-bounds, turnover-on-downs, and challenge-ending events.
- Added exact caption metadata for every announcer script plus a generated announcer caption manifest and HTML audition page under `public/audio/announcer`.
- Added a Node-only ElevenLabs text-to-speech workflow that can generate and preserve three voice-design previews, promote the first acceptable preview to a configurable prototype voice, and render complete MP3 speech assets with provenance sidecars.
- Added idempotent speech-generation behavior that skips unchanged script/voice combinations, protects existing files unless `--force` is supplied, and defaults to dry-run.
- Added audio pipeline coverage for script-catalog validation, caption matching, announcer artifact generation, voice-preview preservation, prototype voice creation, and duplicate speech-generation skipping.

### Changed

- Expanded the audio plan and reports to include announcer speech assets alongside the existing crowd and football SFX plan.
- Updated README, AGENTS, and audio docs to clarify that announcer playback and live runtime text generation remain future work while offline ElevenLabs speech generation is planned product scope.

## [0.32.1] - 2026-06-21

### Fixed

- Added an explicit user-gesture unlock gate so runtime audio does not fetch or prepare generated assets on initial load even when the browser reports the `AudioContext` as running.
- Replaced abrupt bus, loop, and one-shot gain changes with short scheduled ramps to reduce clicks during mute/unmute, bus-volume changes, crowd crossfades, and loop starts/stops.
- Added page activity handling so hidden or unfocused pages fade/stop ambience work and suppress stale result cues without replaying them on resume.
- Expanded audio diagnostics with active node/source counts, prepared media source count, decoded-vs-streamed asset IDs, longest loaded clip, and starter-pack decoded-memory budget reporting.
- Added reliability coverage for pointer and keyboard unlock, mute before/after unlock, audio-disabled startup without generated asset fetches, hidden-page suppression, repeated touchdowns, ambience loop caps, source-node reuse, and one-shot node cleanup.

## [0.32.0] - 2026-06-21

### Added

- Added an immutable presentation audio event bridge with stable event IDs for play preparation, snap, catch, tackle, incomplete, out-of-bounds, first down, touchdown, sack, turnover, and reset events.
- Added deterministic crowd ambience control that starts idle ambience in pre-snap, crossfades toward pressure ambience during live play, returns to idle after results, and prevents duplicate loop instances.
- Added result-driven crowd reactions and football event SFX mapping for snap, catch, tackle, sack, incomplete, first down, touchdown, turnover, and whistle cues.
- Added deterministic non-repeating variant selection and whistle cooldown suppression.
- Added audio debug event history with event ID, chosen asset, trigger time, status, and suppression reason.
- Added unit coverage for one event cue per gameplay result, touchdown precedence over first down, dead-delay dedupe, reset dedupe, muted silence, missing optional reactions, loop reuse, and deterministic variants.

## [0.31.0] - 2026-06-21

### Added

- Added a validated 15-asset ElevenLabs sound-effects starter-pack plan for football crowd loops, crowd reactions, pad hits, catches, whistle, and snap sounds.
- Added runtime loading-strategy metadata to audio generation plans so crowd loops are marked for streaming while one-shots remain buffer candidates.
- Added a richer audio report that records compressed size, measured duration when files exist, one-shot decoded-memory estimates, provenance sidecar status, and starter-pack budget status without decoding crowd loops.
- Added optional report writing for `public/audio/football-sfx-pack-report.json` and `public/audio/audition-index.html`.

### Changed

- Made sound-effect generation idempotent by skipping existing output/sidecar files unless `--force` is supplied.
- Allowed stable lowercase underscore asset IDs for generated football audio assets.

## [0.30.0] - 2026-06-21

### Added

- Added a browser runtime audio mixer foundation with one gesture-unlocked `AudioContext`, master/crowd/announcer/gameplay SFX/UI gain buses, persisted settings, and the temporary `M` mute shortcut.
- Added a typed local audio asset manifest, decoded one-shot loading, streamed long-loop loading, optional-file warnings, and tiny local WAV test assets under `public/audio`.
- Added `?audio=0`, `?crowdAudio=0`, `?announcer=0`, and `?audioDebug=1` runtime audio development controls.
- Added a read-only game audio director and debug overlay that observe gameplay snapshots/events without modifying gameplay state.
- Added unit and browser smoke coverage for bus routing, gesture unlock, mute persistence, optional missing assets, one-shot limits, streamed loop behavior, local test asset playback, and browser-secret scanning.

## [0.29.0] - 2026-06-21

### Added

- Installed the official ElevenLabs `setup-api-key`, `sound-effects`, and `text-to-speech` skills under `.agents/skills` with `skills-lock.json`.
- Added project-specific `football-audio-director` and `football-broadcast-writer` skills for secure offline football audio planning and original broadcast-copy writing.
- Added a typed Node-only audio plan and dry-run generation/reporting pipeline under `tools/audio`.
- Added `npm run audio:plan`, `npm run audio:generate:sfx`, `npm run audio:generate:speech`, and `npm run audio:report`.
- Added safe `.env.example`, `public/audio` staging folders, and documentation for audio direction, secure asset generation, and broadcast writing.
- Added unit coverage for plan validation, missing-key failure, dry-run behavior, existing-file protection, path validation, and secret scanning.

## [0.28.0] - 2026-06-21

### Added

- Replaced the default round ball visual with a shared procedural low-poly football including a brown shell, contrasting seam, low-cost laces, carried orientation, in-flight travel alignment, and visual-only spiral rotation.
- Added `?ballVisual=sphere` / `?ballVisual=football` comparison support while preserving existing ball visibility and gameplay-owned trajectory rules.
- Added deterministic player appearance resolution with six shared skin-tone materials derived only from stable player IDs.
- Added low-poly heads and necks under the existing player head anchor so every mannequin has visible skin inside the separately cloned helmet GLB.
- Added development-only `?appearanceAudit=1` for player ID, skin-tone ID, head bounds, helmet bounds, and head-to-helmet clearance.
- Added unit and browser coverage for football shape metrics, shared football resources, in-flight visual alignment, deterministic skin tones, shared skin materials, head/neck hierarchy, and appearance audit output.

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
