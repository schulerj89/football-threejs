# AGENTS.md

## Project

This repository is a low-poly 3D American football game prototype built with Three.js, Vite, TypeScript, WebGL, and a future WebGPU path. The long-term target is a stylized low-poly 11v11 American-football game with cinematic and broadcast-style presentation. The current score-attack mode is a temporary gameplay test harness, not the final product identity. The current milestone is audio reliability and memory hardening for crowd ambience and football-event cues.

The default active playable prototype is a two-minute five-on-five offensive score-attack drill with semantic data-defined formations for Inside Run, Outside Run, Quick Pass, and Slant Flat. Receiver routes are ordered mathematical paths with gameplay-owned route progress, active segment state, completion state, sampling, tangents, projection, reset behavior, pre-snap on-field route art, development-only route auditing, and route-aware pass targeting. The optional `?playbook=7v7` path runs the fourteen-player `Twin Slants Flat` passing drill with three ordered eligible receivers, explicit pass-protection assignments, explicit coverage assignments, safety deep-help data, quarterback scrambling, sacks, incompletions, catches, possession transfer, tackles, out-of-bounds results, touchdowns, and resets through the same gameplay runtime. The prototype also includes graphical pre-snap SVG play cards generated from gameplay play data, low-poly procedural player bodies with visible low-poly heads, cloned low-poly helmet visuals, deterministic skin-tone presentation, a procedural low-poly football visual, visual-only procedural poses and locomotion, a field generated from a pure field specification with batched static markings and presentation-only turf/yard-number/goalpost/sideline elements, selected eligible receivers on pass plays, AI blockers, AI defenders, deterministic blocking engagements, pass rush, sack classification, a deterministic passing arc, swept catch checks, per-play forward-pass eligibility, explicit ball states, a basic offensive drive, downs, yards-to-go, touchdown scoring, sack, tackle, incomplete, and out-of-bounds outcomes, turnover-on-downs reset, exact dead-ball spotting with three-lane snap placement, signed yardage, moving line of scrimmage, first-down marker, final-score game over, delayed reset, a preserved tactical orthographic camera, an optional behind-the-offense perspective camera, and an optional cinematic broadcast camera. Audio, announcer audio, crowd presentation, and cinematic presentation are planned product scope. The current audio implementation includes offline ElevenLabs production tooling, a 15-asset first football SFX pack plan using `eleven_text_to_sound_v2`, a browser runtime mixer, explicit user-gesture audio unlock, a read-only presentation event bridge with stable event IDs, ramped crowd ambience crossfades, deterministic result reactions, page-activity suppression, and audio debug event history and memory diagnostics. Announcer playback and spatial audio remain future work. The `?formationPreview=7v7` mode remains a static development staging tool for fourteen-player formation validation, rendering, camera framing, and `?presentationAudit=1` presentation checks; it must not run AI or begin a live play.

## Current Non-Goals And Future Scope

- Presentation future scope: stadium, crowd presentation, announcer audio, cinematic presentation polish, stadium seating, sideline characters, advertisements, weather, field degradation, turf redesign, and broader stadium presentation are deferred product work, not permanent exclusions.
- Roster future scope: broader active 7v7 playbooks, 11v11, full special teams, additional offensive or defensive gameplay players beyond the current five-on-five drill and optional Twin Slants Flat 7v7 passing drill, player switching, and formations beyond the current Inside Run, Outside Run, Quick Pass, Slant Flat, Twin Slants Flat, and static 7v7 preview data are deferred.
- Assets and animation future scope: imported full-body player models, imported head models, facial features, hair, skeletal animation, quarterback animation, scramble animation, tackling animation, celebration animation, and center or snap animation are deferred. The current milestone intentionally uses procedural low-poly silhouettes, procedural heads, a procedural football, and the reusable low-poly helmet.
- Play calling: no large playbook menu, title screen, audibles, defensive play selection, route editor, procedural play generation, hot routes, or menus beyond the current pre-snap play cards and minimal HUD/debug displays.
- Passing and ball outcomes: no interceptions, fumbles, loose-ball physics, manual aiming, pass-type selection, pump fake, illegal-forward-pass penalty, referee logic, user-controlled catch mechanic, contested-catch ratings, or quarterback ratings.
- Blocking and tackling: no offensive linemen rules, holding penalties, pancake blocks, double-team blocks, pulling guards, diving tackles, advanced pursuit/pathfinding library, or physics-driven contact.
- Game structure: no quarters, opponent score, halftime, timeouts, NFL clock-stoppage rules, play clock, punts, field goals, penalties, defensive possessions, full game rules, season modes, or franchise systems.
- Controls and camera: no sprinting, stamina, freely rotating camera, camera-relative controls, instant replay, replay recording, camera collision, or camera redesign beyond the current tactical, offense-perspective, and cinematic broadcast modes.
- Audio future scope: no announcer playback, spatial player sounds, music playback, or browser-side ElevenLabs calls in the current milestone. Starter-pack MP3 playback depends on generated local files being present.
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
- The 7v7 roster uses fourteen stable IDs shared through `src/roster.ts`; `?playbook=7v7` is optional playable mode and `?formationPreview=7v7` remains the static development preview. Do not make 7v7 the default playable mode until explicitly requested.
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
- Planned generated assets belong under `public/audio/sfx`, `public/audio/crowd`, and `public/audio/announcer`. Generated asset approval/import is future queued work.
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
- Existing generated audio files and provenance sidecars must not be overwritten without `--force`.
- Each generated audio file must have a provenance sidecar containing prompt or script, model, voice ID where applicable, generation date, output format, and content hash.
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
- Calculate camera offsets relative to the configured direction of play rather than scattering hard-coded field-axis assumptions.
- Preserve field-relative movement controls unless camera-relative controls are explicitly requested.
- Handle browser resizing whenever camera or renderer code changes.
- Keep renderer choices isolated enough that WebGPU can be added without rewriting gameplay scene construction.
- Add or update browser smoke coverage when scene startup, camera framing, renderer boot, resize behavior, controls, or play state changes.

## Done Criteria For This Milestone

- Initial load, keyboard unlock, pointer unlock, mute before unlock, mute after unlock, hidden-page suppression, focus loss, rapid resets, repeated touchdowns, camera switching, and `?audio=0` remain reliable.
- Bus, loop, one-shot, mute, and crossfade gain changes use scheduled ramps to avoid clicks.
- Long crowd loops remain streamed media elements, and decoded `AudioBuffer` use remains limited to short one-shots.
- Compressed starter audio stays under 5 MiB, estimated decoded one-shot memory stays under 8 MiB, active crowd media elements stay capped at two during transitions, and completed one-shot nodes are not retained.
- Hidden or unfocused pages reduce ambience work and do not replay stale result events on resume.
- `?audioDebug=1` shows event history plus compressed bytes, decoded memory estimate, active node/source counts, longest loaded clip, and streamed versus decoded asset IDs.
- Announcer playback, spatial audio, visual crowd, camera changes, and gameplay changes are not implemented in this milestone.
- Existing audio pipeline, runtime audio, five-on-five gameplay, optional 7v7 passing drill, route art, play cards, helmet, mannequin, visual, camera, unit, and browser smoke tests pass.
