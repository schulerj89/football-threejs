# AGENTS.md

## Project

This repository is a low-poly 3D American football game prototype built with Three.js, Vite, TypeScript, WebGL, and a future WebGPU path. The long-term target is a stylized low-poly 11v11 American-football game with cinematic and broadcast-style presentation. The current score-attack mode is a temporary gameplay test harness, not the final product identity. The active prototype is the fourteen-player 7v7 default game mode while 5v5 remains an explicit legacy development and regression mode. The next roster milestone is 11v11. Current presentation integration work should preserve one authoritative immutable presentation-event stream for audio, commentary, crowd, camera, captions, and holds.

The default active playable prototype is a two-minute seven-on-seven offensive score-attack drill with semantic data-defined formations for Inside Zone 7, Outside Zone 7, Quick Pass 7, and Twin Slants Flat. Receiver routes are ordered mathematical paths with gameplay-owned route progress, active segment state, completion state, sampling, tangents, projection, reset behavior, pre-snap on-field route art, development-only route auditing, and route-aware pass targeting. The explicit `?playbook=5v5` path preserves the legacy five-on-five drill with Inside Run, Outside Run, Quick Pass, and Slant Flat for regression coverage. The prototype also includes graphical pre-snap SVG play cards generated from gameplay play data, low-poly procedural player bodies with visible low-poly heads, cloned low-poly helmet visuals, deterministic skin-tone presentation, a procedural low-poly football visual, visual-only procedural poses and locomotion, a field generated from a pure field specification with batched static markings and presentation-only turf/yard-number/goalpost/sideline elements, selected eligible receivers on pass plays, AI blockers, AI defenders, deterministic blocking engagements, pass rush, sack classification, a deterministic passing arc, swept catch checks, per-play forward-pass eligibility, explicit ball states, a basic offensive drive, downs, yards-to-go, touchdown scoring, sack, tackle, incomplete, and out-of-bounds outcomes, turnover-on-downs reset, exact dead-ball spotting with three-lane snap placement, signed yardage, moving line of scrimmage, first-down marker, final-score game over, delayed reset, a preserved tactical orthographic camera, a behind-the-offense perspective camera, an optional cinematic broadcast camera, optional cinematic orbit shots, normal-game low-density crowd visuals and reactions in the broadcast profile, and full-cinematics fan cutaways. `GamePresentationRuntime` owns the shared presentation-event stream and coordinates existing audio, commentary, crowd, hold, and camera systems without determining gameplay results. Audio, announcer audio, crowd presentation, and cinematic presentation are planned product scope. The current audio implementation includes offline ElevenLabs production tooling, a generated 15-asset football SFX/crowd pack using `eleven_text_to_sound_v2`, a generated 27-line prototype announcer voice pack with exact captions, a typed announcer script catalog, a prototype fictional announcer identity, a Node-only voice-design preview workflow, `npm run audio:verify`, a browser runtime mixer, explicit user-gesture audio unlock, a read-only presentation event bridge with stable event IDs, ramped crowd ambience crossfades, deterministic result reactions, serialized pre-rendered announcer commentary with priority/cooldown logic, optional exact-script captions, crowd ducking during speech, page-activity suppression, and audio/commentary debug history and memory diagnostics. The current crowd implementation includes normal-game InstancedMesh visual crowd presentation through the broadcast/custom settings path, deterministic result reactions, a presentation hardening audit matrix, `?crowdPreview=1`, procedural sideline/end-zone seating shells, InstancedMesh low-poly spectators, near/far detail tiers, preview camera controls, and benchmark reporting for 500, 2,000, 5,000, and 10,000 spectators. Spatial audio, live text generation, detailed stadium activation, and music remain future work. The `?formationPreview=7v7` mode remains a static development staging tool for fourteen-player formation validation, rendering, camera framing, and `?presentationAudit=1` presentation checks; it must not run AI or begin a live play. `?crowdPreview=1` is also a development-only mode and must not run gameplay AI.

## Current Non-Goals And Future Scope

- Presentation future scope: broader stadium activation, detailed crowd choreography, sideline characters, advertisements, weather, field degradation, turf redesign, and broader stadium presentation are deferred product work, not permanent exclusions. The current crowd work includes optional normal-game visual crowd presentation plus the development-only rendering and memory preview.
- Roster future scope: 11v11 is the next roster milestone. Full special teams, additional roster tiers beyond the current default 7v7 playbook and legacy 5v5 regression mode, player switching, and broader formation families are deferred.
- Assets and animation future scope: imported full-body player models, imported head models, facial features, hair, skeletal animation, quarterback animation, scramble animation, tackling animation, celebration animation, and center or snap animation are deferred. The current prototype intentionally uses procedural low-poly silhouettes, procedural heads, a procedural football, and the reusable low-poly helmet.
- Play calling and setup: no large playbook menu, final title artwork, audibles, defensive play selection, route editor, procedural play generation, hot routes, team selection, roster editing, season mode, save slots, or menus beyond the current title/setup flow, pause settings panel, pre-snap play cards, and minimal HUD/debug displays.
- Passing and ball outcomes: no interceptions, fumbles, loose-ball physics, manual aiming, pass-type selection, pump fake, illegal-forward-pass penalty, referee logic, user-controlled catch mechanic, contested-catch ratings, or quarterback ratings.
- Blocking and tackling: no offensive linemen rules, holding penalties, pancake blocks, double-team blocks, pulling guards, diving tackles, advanced pursuit/pathfinding library, or physics-driven contact.
- Game structure: no quarters, opponent score, halftime, timeouts, NFL clock-stoppage rules, play clock, punts, field goals, penalties, defensive possessions, full game rules, season modes, or franchise systems.
- Controls and camera: no sprinting, stamina, freely rotating camera, camera-relative controls, instant replay, replay recording, slow motion, camera collision, or camera redesign beyond the current tactical, offense-perspective, cinematic broadcast, optional orbit-shot, and optional fan-cutaway presentation modes.
- Audio future scope: no spatial player sounds, music playback, live text generation, conversational agents, second commentator, or browser-side ElevenLabs calls in runtime gameplay. The first runtime MP3 pack is generated and verified locally; future audio work should preserve existing approved assets unless replacement is explicit.
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
- Normal-game presentation defaults belong behind `src/config/GameExperienceSettings.ts`. Do not independently resolve default camera, cinematics, visual crowd, crowd reactions, crowd audio, gameplay SFX, announcer, captions, route art, player motion, or playbook behavior in `main.ts`.
- The broadcast experience preset is the default normal-game profile: 7v7 playbook, offense camera, brief cinematics, low-density crowd visuals, crowd reactions, runtime audio, crowd audio, announcer enabled, captions disabled, route art enabled, and player motion enabled.
- The performance preset keeps the offense camera and player motion while disabling expensive visual presentation: cinematics, visual crowd, and crowd reactions.
- Query parameters are explicit development/session overrides and must not rewrite persisted experience settings.
- Keep `formationPreview`, `crowdPreview`, `routeAudit`, `passAudit`, `presentationAudit`, `shotPreview`, and `appearanceAudit` development-only and opt-in.
- The title/setup flow belongs under `src/ui`. It should compose resolved `GameExperienceSettings`, not create a competing settings source.
- A normal launch should show the title screen before gameplay. Direct query and development preview/audit paths may still enter their requested mode directly for tests and debugging.
- Start Game must count as the audio-unlock user gesture, apply the selected settings, select or construct the chosen playbook, enter pre-snap, and reveal HUD/play cards.
- While the title screen or pause settings panel is active, the score clock, gameplay AI, play controls, presentation result events, and play cards must not advance behind the UI.
- Escape may open the pause settings panel only during pre-snap or dead-ball states. Live play should remain responsive and uninterrupted.
- Settings changed from the pause panel may apply presentation and audio changes safely. Game mode changes require returning to the title screen.
- Missing optional generated audio should not produce player-facing startup errors; show detailed asset readiness only through development/debug surfaces.
- Use primitive Three.js geometry and simple materials during graybox work.
- Keep input, simulation, and visual synchronization in separate modules.
- All gameplay players use the common player model with stable ID, team, role, position, velocity, facing, collision radius, and current state.
- Default active formations use the stable 14-player 7v7 roster shared through `src/roster.ts`: `offense-qb`, `offense-rb`, `offense-center`, `offense-line-left`, `offense-line-right`, `offense-wr-left`, `offense-wr-right`, `defense-line-left`, `defense-line-middle`, `defense-line-right`, `defense-corner-left`, `defense-corner-right`, `defense-linebacker`, and `defense-safety`.
- The legacy 5v5 roster remains available only through explicit development/regression selection: `?playbook=5v5` or `5v5 Legacy Development Mode`.
- Initial formations belong in semantic data resolved through `src/formationLayout.ts`, not hard-coded mesh positions or independent per-play clamps.
- Formation preview positions must resolve through the semantic formation system for each snap lane and must fail validation rather than clamping invalid geometry.
- Formation data should separate formation position, pre-snap facing, post-snap movement direction, blocking targets, route targets, and coverage assignments.
- Play definitions belong in data and must stay independent from Three.js scene objects.
- Play-call card diagrams must be generated from `PlayDefinition`, resolved formation, resolved receiver routes, and blocker targets; do not maintain separate diagram coordinates.
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
- Route-aware pass targeting belongs in `src/passTargeting.ts` or similarly pure gameplay math. Normal passing should predict the selected receiver from route progress and route speed instead of using a fixed lead-distance fallback.
- Catch detection should use gameplay-owned previous/current ball and receiver positions for swept relative-motion checks rather than relying only on a single frame's positions.
- Pass audit diagnostics are development-only and may read gameplay snapshots, but must never affect pass targeting, catch outcomes, possession, timing, or play state.
- Receiver route definitions belong in `src/receiverRoutes.ts` as ordered waypoint paths resolved through formation and snap-placement math. Route progress, active segment, and completion state belong to gameplay state, not Three.js objects or visual pose state.
- Route following must advance by `speedYardsPerSecond * deltaSeconds`, must not depend on frame count, and must stop immediately when user control transfers to a receiver after a catch.
- Receiver simulation, graphical play cards, and on-field route art must consume the same `ResolvedReceiverRoute` objects or route-resolution helpers. Do not maintain separate route-art or play-card coordinates.
- On-field route art belongs in `src/presentation/RouteArtRenderer.ts`; it may read gameplay snapshots and resolved routes but must never mutate gameplay state, pass targeting, possession, collisions, or timing.
- Route-art static path geometry should rebuild only when the play, snap spot, or route definition changes. Audit-only dynamic lines may update existing buffer attributes, but do not allocate new route geometry every frame.
- Route-art owned geometries and materials must be disposed explicitly without disposing globally shared game resources.
- Imported player art and procedural player silhouettes must remain visual-only; gameplay collision stays in the gameplay player model.
- Player visuals should preserve the root object used by gameplay synchronization, keep the helmet attached through the stable head anchor, and expose comparison/debug URL options when replacing major placeholder geometry.
- Player head and neck geometry must remain presentation-only under the existing head anchor. Skin tone must resolve deterministically from stable player identity, not team, role, selected receiver, play, camera, reset, or random state.
- Skin-tone materials should be shared by palette entry. Do not allocate unique skin materials per player.
- The football visual must remain presentation-only. Do not add visual velocity to `BallModel`, change gameplay trajectory, change catch logic, or make ball mesh transforms authoritative.
- Football geometry and materials should be shared; comparison support should preserve `?ballVisual=sphere` and the default `?ballVisual=football`.
- Appearance audit code must be development-only presentation readback. It may measure head and helmet bounds but must never affect gameplay, collision, passing, possession, timing, or AI.
- ElevenLabs is an offline production dependency only. Runtime browser code must never call ElevenLabs, import `@elevenlabs/elevenlabs-js`, receive `ELEVENLABS_API_KEY`, or use a `VITE_`-prefixed ElevenLabs key.
- Consult installed official ElevenLabs skills under `.agents/skills` for API setup, sound-effects generation, and text-to-speech usage. Do not copy or rewrite official API instructions into project docs when those skills can be referenced.
- Project audio direction and broadcast-writing rules live under `.codex/skills/football-audio-director` and `.codex/skills/football-broadcast-writer`.
- Node-only audio production scripts live under `tools/audio`. Generation commands must default to dry-run and require `--execute` before any paid API call.
- Use the direct `tsx` command for paid sound-effects generation when passing flags, for example `npx tsx tools/audio/generateSoundEffects.ts --execute --max-files=15`.
- Never log API keys, commit local `.env` files, commit request headers containing real secrets, or expose secret-bearing manifests.
- Generated prototype assets belong under `public/audio/sfx`, `public/audio/crowd`, and `public/audio/announcer`. Preserve approved MP3s and provenance sidecars; do not regenerate or overwrite them unless the user explicitly asks or passes `--force`.
- Use `npm run audio:verify` after generation. It must validate runtime-manifest filenames, non-empty decodable files, duration bounds, provenance sidecars, caption metadata, compressed-size budget, decoded-buffer budget policy, readiness classification, and the audition page.
- Browser runtime audio lives under `src/audio` and must use local audio files only. It must never call ElevenLabs, import the ElevenLabs SDK, read API keys, or expose secret-bearing data to Vite/browser code.
- Runtime audio must create exactly one `AudioContext`, route crowd, announcer, gameplay SFX, and UI buses through master, and start, resume, fetch, or prepare playable assets only after an explicit user gesture unlock.
- Bus, loop, one-shot, mute, and crossfade gain changes must use short scheduled ramps rather than abrupt gain jumps.
- Long ambience or crowd loops should use `HTMLAudioElement` plus `MediaElementAudioSourceNode`; do not decode long loops into one large `AudioBuffer`.
- `GameAudioDirector` may consume immutable gameplay snapshots or events, but must never modify play state, reset timing, scoring, possession, collision, or gameplay outcomes.
- Presentation audio events belong in `src/audio/PresentationEventBridge.ts`. Event IDs must be stable and deduplicate gameplay results by play/result identity, not by UI rerenders or camera state.
- Runtime crowd ambience may keep at most the idle loop and pressure loop active during crossfades; do not start duplicate loop instances.
- Variant selection must be deterministic and must avoid immediate repetition without using unseeded `Math.random`.
- Hidden or unfocused pages must suppress stale result cues and reduce ambience work without replaying old result events on resume.
- `?audioDebug=1` must expose compressed bytes, decoded memory estimate, active node/source counts, longest loaded clip, and streamed versus decoded asset IDs for development audits.
- Runtime broadcast commentary lives in `src/audio/BroadcastCommentaryDirector.ts`, consumes immutable presentation events, and must never call ElevenLabs or mutate gameplay state.
- Runtime commentary clip data lives in `src/audio/CommentaryCatalog.ts` and should stay caption-matched to the offline announcer script catalog.
- Broadcast captions live in `src/ui/BroadcastCaptions.ts`, must use exact generated script text, and must remain optional/accessibility-friendly DOM text.
- Commentary must serialize announcer playback, avoid immediate variant repetition, apply per-category cooldowns, avoid speaking on every play, and let high-priority events cancel obsolete queued lower-priority lines.
- While announcer speech is active, only the crowd bus may be ducked. Gameplay SFX should remain unchanged, and crowd ducking must restore after speech, mute, reset, hidden-page suppression, or stopped speech.
- Existing generated audio files and provenance sidecars must not be overwritten without `--force`.
- Each generated audio file must have a provenance sidecar containing prompt or script, model, voice ID where applicable, generation date, output format, and content hash.
- Normal-game crowd presentation lives in `src/presentation/CrowdPresentationController.ts` and is activated through resolved game experience settings. Broadcast enables low-density crowd visuals and reactions by default; performance disables them. `?crowdVisuals=0|1`, `?crowdDensity=low|medium|high`, and `?crowdReactions=0|1` remain development/session overrides.
- Normal-game presentation coordination lives in `src/presentation/GamePresentationRuntime.ts`. It must derive presentation events once per frame, apply event precedence, and feed the same immutable event array to existing audio, commentary, crowd, hold, and camera systems.
- Presentation event precedence is touchdown over turnover on downs over sack over first down over incomplete/out-of-bounds over ordinary tackle. Touchdown presentation must suppress same-play first-down presentation.
- Presentation runtime integration history is development/debug data only. It may report event IDs, result IDs, camera shots, crowd reactions/audio, announcer clips/captions, holds, and reset completion, but must never mutate gameplay state.
- Normal-game crowd density presets must map to measured benchmark counts: low 500, medium 2,000, and high 5,000 spectators. Do not invent unmeasured density defaults.
- Normal-game crowd reactions must consume immutable presentation event IDs and must not infer scoring, first downs, possession, or play outcomes from camera, HUD, audio playback, or mesh state.
- Crowd reactions must use deterministic instance subsets and phase offsets, must avoid unseeded `Math.random`, and must update instanced transforms at a bounded low frequency rather than rebuilding the crowd every render frame.
- Normal-game crowd visuals must use `InstancedMesh` with shared geometry/material sets and must not allocate one `Object3D`, geometry, material, or animation object per spectator.
- Normal-game crowd visuals, reactions, and cutaways must be optional. Disabled crowd visuals must not create crowd GPU resources or load unnecessary generated audio.
- Presentation hold and cutaway coordination may delay only automatic dead-play reset when cinematics are enabled and the gameplay result is already authoritative. It must not delay scoring, change possession, alter collision, or determine gameplay outcomes. `?cinematics=off` must preserve the previous reset timing.
- Presentation hardening audits live in `src/presentation/PresentationHardeningAudit.ts` and may report audio/crowd/camera/hold diagnostics, but must not mutate gameplay state or trigger presentation events.
- Seven-on-seven gameplay hardening audits live in `src/sevenOnSevenAudit.ts` and are enabled with `?sevenAudit=1`. They may report roster count, assignments, route errors, stale engagements, overlaps, presentation event state, and resource counters, but must not mutate gameplay or presentation state.
- Seven-on-seven matrix tests should cover the active 7v7 playbook across all plays, snap lanes, tactical/offense/cinematic camera configuration values, off/brief cinematics, disabled/low crowd modes, and 30/60/120 Hz update rates where simulation tests support them.
- Development crowd rendering lives in `src/crowdPreview.ts` and must remain disabled unless `?crowdPreview=1` is present.
- Crowd preview must use `InstancedMesh` with shared geometry/material sets and must not create one `Object3D`, geometry, or material per spectator.
- Crowd preview may report frame time and FPS as machine-specific measurements, but hard acceptance should focus on bounded draw calls, bounded geometry/material counts, explicit instance-buffer estimates, and clean startup/disposal.
- Crowd preview must not run gameplay AI, start live plays, mutate gameplay state, or activate normal-game crowd presentation.
- Crowd benchmark reporting must include requested/actual spectator counts, crowd draw calls, triangles, geometry/material/texture counts, estimated instance-buffer bytes, frame time, minimum observed FPS, and renderer memory counters.
- Procedural player pose and locomotion belong in `src/presentation/PlayerPoseController.ts`; pose controllers may read gameplay snapshots and transform visual pivots but must never mutate gameplay state.
- Pose amplitudes, blend rates, stride rates, velocity thresholds, and frame-delta clamps belong in a single pose configuration object.
- Presentation audits belong in `src/presentationAudit.ts`; they may perform expensive `Box3` and projection checks only when the debug overlay, pose debug, or `?presentationAudit=1` is enabled.
- `?presentationAudit=1` is development-only and may create presentation-only cloned snapshots for locomotion preview; it must never mutate formation preview players or add active 7v7 gameplay behavior.
- Formation preview player roots must remain at exact gameplay coordinates while procedural poses affect only visual child pivots and meshes.
- Normal player body colors should emphasize team identity; role-specific body colors belong behind explicit debug options.
- Repeated GLB assets should be loaded once and cloned or instanced, with material clones created before team-specific tinting.
- Forward-pass eligibility is gameplay state reset per play; crossing the original line of scrimmage disables it permanently for that play using the documented epsilon in `src/passRules.ts`.
- Sack classification belongs in gameplay rules and must depend on possession, pass attempt state, line of scrimmage, and defender contact.
- Tackling must use explicit configurable collision radii.
- Preserve the tactical orthographic gameplay camera for comparison and debugging.
- Keep camera behavior in a dedicated camera controller that reads gameplay snapshots and never mutates gameplay state.
- Cinematic presentation shots belong in `src/camera/PresentationCameraDirector.ts`; the director may read gameplay snapshots and move only camera presentation state.
- Presentation cameras must never move gameplay players, change play state, delay scoring, change possession, change collision, or determine gameplay outcomes.
- Cinematic orbit shots must extend the existing `PresentationCameraDirector`; do not add a competing camera director.
- `?cinematics=off|brief|full` controls optional orbit presentation for a session. Broadcast defaults to `brief`; performance defaults to `off`. Query overrides must remain explicit and non-persistent.
- `prePlayOrbit180` may run during pre-snap setup but Space must still start the play immediately. Starting or resetting play may skip/abort the shot, but must not discard input.
- `touchdownOrbit360` may start only after a touchdown result is already authoritative in gameplay state. It must never decide scoring, delay scoring, or alter reset timing.
- Orbit-shot paths must be derived from play direction, formation bounds, scorer/dead-ball location, field bounds, and aspect ratio rather than one snap lane or hard-coded player count.
- `?shotPreview=prePlayOrbit180|touchdownOrbit360|firstDownCrowdCutaway|touchdownCrowdCutaway` and `?cameraDebug=1` are development presentation tools only. They may expose shot progress, orbit or cutaway center, radius, camera position, look target, and restore camera, but must not mutate gameplay state.
- Calculate camera offsets relative to the configured direction of play rather than scattering hard-coded field-axis assumptions.
- Preserve field-relative movement controls unless camera-relative controls are explicitly requested.
- Handle browser resizing whenever camera or renderer code changes.
- Keep renderer choices isolated enough that WebGPU can be added without rewriting gameplay scene construction.
- Add or update browser smoke coverage when scene startup, camera framing, renderer boot, resize behavior, controls, or play state changes.

## Done Criteria For This Milestone

- The deterministic 7v7 matrix covers every active 7v7 play, every snap lane, tactical/offense/cinematic camera configuration values, off/brief cinematics, disabled/low crowd modes, and 30/60/120 Hz update-rate scenarios.
- Repeated pre-snap updates preserve positions, facing, snap lane, assignments, and route progress.
- Run and pass plays validate ball carrier/quarterback possession, unique blocking/protection/coverage assignments, route ordering, route timing, update-rate consistency, sacks, catches, incompletions, and reset cleanup.
- All seven-on-seven result paths produce one authoritative result, advance the drive once, reset players cleanly, and avoid stale engagements or stale route state.
- `?sevenAudit=1` reports roster count, assignments, route errors, stale engagements, overlap warnings, active presentation event, and resource counters.
- At least 100 snap/reset cycles keep active players and visual roots at fourteen while geometry/material/audio/presentation counts remain bounded.
- Existing tactical, offense-perspective, cinematic broadcast, 5v5 regression, 7v7 gameplay, crowd preview, audio, route art, play cards, helmet, mannequin, visual, camera, unit, build, and browser smoke tests pass.
