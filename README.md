# Football Three.js

Low-poly 3D American football prototype built with Three.js, Vite, and TypeScript.

The long-term target is a stylized low-poly 11v11 American-football game with cinematic and broadcast-style presentation. The current score-attack mode is a temporary gameplay test harness for validating controls, play states, formations, ball spotting, passing, tackling, downs, and camera language before the full game structure arrives.

The active default prototype is now a twenty-two-player 11v11 offensive score-attack mode with Inside Zone 11 and Spread Quick 11. The 7v7 drill is retained as a maintained development regression mode through `?playbook=7v7`, and the legacy 5v5 drill remains available through `?playbook=5v5` and the setup screen. Development formation preview supports static 7v7 and 11v11 staging. A shared normal-game presentation runtime coordinates authoritative result events across crowd visuals, crowd audio, gameplay effects, announcer commentary, captions, cinematic holds, and camera shots without changing gameplay outcomes. The prototype includes runtime broadcast-announcer playback from local pre-rendered assets, graphical pre-snap SVG play cards generated from gameplay data, visual-only procedural player poses and locomotion, route-aware passing consistency, receiver routes as ordered mathematical paths, pre-snap field route art, development-only route/pass/appearance/audio/commentary/crowd/camera/formation auditing, low-density normal-game crowd visuals and reactions in the broadcast profile, a procedural football, visible low-poly player heads, and a basic offensive drive: a field generated from a pure field specification with batched static markings, turf bands, yard numbers, goalposts, sideline presentation, selectable play calls, quarterback scrambling with a line-of-scrimmage passing rule, route-running receiver behavior, selected-target passing with a deterministic arc, swept catch detection, downs, yards-to-go, first-down line, touchdown scoring, sack, tackle, incomplete, and out-of-bounds outcomes, turnover-on-downs reset, exact dead-ball spotting with three-lane snap placement, final-score game over, development-only formation preview staging, the preserved orthographic three-quarter camera, the behind-the-offense perspective camera, and the optional cinematic broadcast camera.

## World Scale

- `1 Three.js world unit = 1 yard`.
- The field is `120 x 53.33` units, matching a 100-yard playable field plus two 10-yard end zones.
- The `X` axis runs sideline to sideline, `Z` runs end zone to end zone, and `Y` is vertical.
- Direction of play is positive `Z`.
- The initial line of scrimmage is at `Z = -15`.
- Field dimensions, paint widths, field bounds, playable bounds, and plain layout data are centralized in `src/fieldSpec.ts`.
- Static field markings are batched by material while the line of scrimmage, first-down line, and play-direction marker remain dynamic.
- Yard numbers face the sidelines, and the presentation-only goalposts sit on the end lines at the back of each end zone.
- Painted hash marks and snap-placement hash lanes share the same widened arcade hash X value derived from the professional hash position.
- World-unit to football-yard conversion is centralized in `src/fieldScale.ts`.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run audio:plan
npm run audio:generate:sfx
npm run audio:generate:speech
npm run audio:report
npm run audio:verify
npm run test:unit
npm run test:smoke
npm test
```

Open the dev server at `http://127.0.0.1:5173`.

## Audio Production

ElevenLabs is used for offline generation only. Production browser code must not call ElevenLabs, receive `ELEVENLABS_API_KEY`, or use any `VITE_`-prefixed ElevenLabs secret.

- Official installed skills: `.agents/skills/setup-api-key`, `.agents/skills/sound-effects`, and `.agents/skills/text-to-speech`.
- Project skills: `.codex/skills/football-audio-director` and `.codex/skills/football-broadcast-writer`.
- Typed plan: `tools/audio/audioPlan.ts`.
- Broadcast script catalog: `tools/audio/announcerScriptCatalog.ts`.
- Announcer caption manifest and audition page: `public/audio/announcer/announcer-captions.json` and `public/audio/announcer/announcer-audition.html`.
- Generated starter pack: two streamed crowd loops, six crowd reactions, seven football one-shots, and 27 announcer speech clips.
- Safe local example: `.env.example`.
- Output roots: `public/audio/sfx`, `public/audio/crowd`, and `public/audio/announcer`.

`npm run audio:generate:sfx` and `npm run audio:generate:speech` default to dry-run. Paid API calls require an explicit `--execute` flag, such as `npx tsx tools/audio/generateSoundEffects.ts --execute --max-files=15` or `npx tsx tools/audio/generateSpeech.ts --execute --max-files=27`; existing files require `--force` to replace, and one execution is capped by `--max-files` or `AUDIO_MAX_FILES`.

The richer report can be printed with `npm run audio:report` and written with `npx tsx tools/audio/audioReport.ts --write`. `npm run audio:verify` validates runtime-manifest filenames, non-empty decodable MP3s, duration bounds, provenance sidecars, caption metadata, compressed-size budget, decoded-buffer budget policy, readiness classification, and the audition page at `public/audio/audition-index.html`. The browser runtime mixer consumes local files only. Runtime announcer playback uses the local `public/audio/announcer/*.mp3` files, serializes commentary so clips do not overlap, and shows exact captions when enabled. Spatial player sounds, live text generation, second-commentator support, and music are queued future tasks.

## Controls

- A normal launch opens the title screen. Choose `Start Game` to enter the selected prototype and unlock browser audio from that user gesture.
- The title screen supports `Broadcast`, `Performance`, and `Custom` presentation profiles plus `11v11 Prototype`, `7v7 Development Regression Mode`, and `5v5 Legacy Regression Mode` game modes.
- Custom title settings expose gameplay camera, cinematics, visual crowd, crowd density, crowd reactions, master audio, crowd audio, announcer, and captions.
- Move with `WASD` or the arrow keys.
- In the default 11v11 prototype, press `1` during pre-snap to select `Inside Zone 11`.
- In the default 11v11 prototype, press `2` during pre-snap to select `Spread Quick 11`.
- Use `?playbook=7v7` or `7v7 Development Regression Mode` to run the maintained seven-on-seven regression drill with Inside Zone 7, Outside Zone 7, Quick Pass 7, and Twin Slants Flat.
- Use `?playbook=5v5` or `5v5 Legacy Regression Mode` to run the preserved five-on-five regression drill.
- Click or tap a pre-snap play card to select that play.
- Press `Space` from pre-snap to start the play and give the player possession.
- Press `E` before throwing on a passing play to cycle eligible receivers.
- Press `F` during a passing play to throw once toward the selected eligible receiver. The target is predicted from the receiver's current route progress and the ball's deterministic flight time.
- Press `R` to reset the play to pre-snap.
- Press `Enter` from game over to restart the two-minute score attack.
- Press `C` in development or with `?debug=1` to cycle through tactical orthographic, behind-the-offense perspective, and cinematic broadcast cameras.
- Press `Escape` during pre-snap or dead-ball states to open the settings panel. Volume, captions, camera, cinematics, and crowd settings apply safely where practical; game mode changes require returning to the title screen.
- A plain launch uses the `broadcast` experience preset: 11v11 playbook, offense camera, brief cinematics, low-density crowd visuals and reactions, runtime audio, announcer, pre-snap route art, and player motion.
- Use `?experience=broadcast`, `?experience=performance`, or `?experience=custom` to choose the resolved normal-game profile. The `performance` preset keeps the offense camera and player motion but disables cinematics, visual crowd, and crowd reactions.
- Query parameters such as `?camera=`, `?cinematics=`, `?crowdVisuals=`, `?audio=`, `?announcer=`, `?captions=`, `?routeArt=`, and `?playerMotion=` are explicit development overrides and do not rewrite persisted experience settings.
- Use `?cinematics=off`, `?cinematics=brief`, or `?cinematics=full` to control optional orbit-shot presentation for a session. The broadcast preset defaults to `brief`; the performance preset defaults to `off`.
- Use `?shotPreview=prePlayOrbit180`, `?shotPreview=touchdownOrbit360`, `?shotPreview=firstDownCrowdCutaway`, or `?shotPreview=touchdownCrowdCutaway` with `?cameraDebug=1` to inspect presentation shots without changing gameplay rules.
- Add `?cameraDebug=1` to show camera and shot debug output without enabling the broader debug overlay path.
- Press `M` to toggle the temporary runtime audio mute setting after the first user gesture unlocks audio.
- Use `?camera=tactical`, `?camera=offense`, or `?camera=cinematic` to choose the starting camera mode.
- Use `?audio=0`, `?crowdAudio=0`, or `?announcer=0` to disable runtime audio, crowd-loop playback, or announcer playback paths during development.
- Use `?captions=1` to enable broadcast captions for announcer lines.
- Use `?commentaryDebug=1` to show commentary queue, cooldown, current clip, source event, priority, and crowd duck state.
- The broadcast preset enables the normal-game budgeted visual crowd at low density. Use `?crowdVisuals=0` to disable it, or `?crowdVisuals=1` to explicitly enable it when using another preset. Use `?crowdDensity=low`, `?crowdDensity=medium`, or `?crowdDensity=high` for benchmarked 500, 2,000, or 5,000 spectator presets. Use `?crowdReactions=0` to keep the crowd static.
- The graphical play cards are visible only during pre-snap and are generated from the same play definitions, resolved formation positions, routes, and blocker assignments used by gameplay.
- Play selection is locked while a play is live; reset preserves the selected play.
- The HUD shows the selected target for passing plays.
- The score-attack clock starts on the first snap, runs continuously after that, and clamps at `0:00`.
- If time expires during a live play, that play may finish before game over.
- Passing plays start with the quarterback in possession; after a catch, possession and user control transfer to the receiver.
- The quarterback may scramble before throwing.
- Crossing the original line of scrimmage permanently disables forward passing for that play; pressing `F` after crossing shows `PAST LINE OF SCRIMMAGE` and does not throw.
- Before a throw, ordinary defenders rush the quarterback; contact behind the line of scrimmage ends the play as a sack.
- Cross the opposing goal line during a live play to score a touchdown.
- Avoid defenders to score; defender contact ends the play as a tackle.
- AI blockers move toward lane targets and can engage one defender each to slow pursuit.
- Coverage defenders track their assigned receivers while ordinary defenders use the existing simple pursuit or pass-rush behavior. In the default 11v11 playbook, Inside Zone 11 uses explicit one-to-one run-blocking assignments and Spread Quick 11 uses five offensive pass protectors, five eligible receivers, explicit coverage assignments, and deep safety help. Defenders switch to carrier pursuit after a catch.
- Receiver route definitions are ordered waypoint paths resolved through the same formation and snap-placement math as player formations. Runtime route progress belongs to the gameplay model and resets with play selection, snap, play reset, and challenge restart. Receiver simulation, graphical play cards, and on-field route art all consume `ResolvedReceiverRoute` data rather than separate diagram coordinates.
- Pass targeting samples the selected receiver's declared route path instead of using a fixed lead-distance heuristic. Catch checks use swept ball/receiver motion between frames so equivalent throws remain deterministic across common update rates.
- Crossing a sideline during a live play ends the play out of bounds.
- AI-controlled non-carriers stay inside the playable field while the active ball carrier may cross a sideline to end the play.
- Each procedural low-poly player body keeps its gameplay-driven collision and movement while displaying a cloned `low_poly_helmet.glb` helmet attached to a head anchor.
- Each active player has a low-poly head and neck under the existing head anchor. Skin tone is presentation-only, deterministic from stable player ID, and shared by palette material.
- Use `?playerBody=mannequin` for the current low-poly silhouette or `?playerBody=box` for comparison with the earlier rectangular placeholder body.
- Use `?ballVisual=football` for the current low-poly football or `?ballVisual=sphere` for comparison with the earlier round placeholder ball.
- Use `?playerMotion=0` to disable visual-only procedural poses and locomotion for comparison.
- Use `?debugRoleColors=1` to restore role-colored player bodies for visual debugging.
- Use `?formationPreview=7v7` for the static fourteen-player development preview. In that mode, press `1` for left-hash staging, `2` for middle staging, and `3` for right-hash staging. Space does not start a play in preview mode.
- Use `?formationPreview=11v11` for the static twenty-two-player development preview. Press `1` for left hash, `2` for middle, `3` for right hash, and `4` to mirror the preferred formation side. This renders all mannequins and helmets and frames the complete formation without running 11v11 gameplay AI.
- Use `?presentationAudit=1` with `?formationPreview=7v7` to show the 7v7 presentation audit. Add `?presentationState=locomotion` or press `L` for the visual-only locomotion preview; press `P` to return to pre-snap audit framing.
- Use `?crowdPreview=1` for the development-only crowd rendering and memory preview. Add `?crowdCount=500`, `?crowdCount=2000`, `?crowdCount=5000`, or `?crowdCount=10000` to choose spectator count; counts are clamped at 10,000. In crowd preview, press `1` for a wide stadium view, `2` for sideline, `3` for end-zone, and `4` for close crowd inspection. The preview does not run gameplay AI.
- Add `?crowdBenchmark=1` in crowd preview to automatically sweep 500, 2,000, 5,000, and 10,000 spectators for a fixed interval and print/report draw calls, triangles, frame time, FPS, renderer counters, and explicit instance-buffer estimates. `?crowdBenchmarkDuration=seconds` can shorten or lengthen the development benchmark interval.
- Use `?routeArt=0` to disable pre-snap on-field receiver route art, or `?routeArt=1` to explicitly enable it.
- Use `?routeAudit=1` to show development route auditing with active segment, route distance, completion percentage, nearest projected route point, and cross-track error.
- Use `?passAudit=1` to show development pass targeting diagnostics, including release position, predicted target, predicted receiver position, predicted flight time, closest approach, miss distance, catch height, and catch/incompletion reason.
- Sack, tackle, completed pass, and out-of-bounds results display signed yards gained or lost from the exact dead-ball spot, then reset the next play at the nearest snap lane: left hash, middle, or right hash.
- Incomplete passes end the play at the original line of scrimmage and advance the down.
- The drill tracks down, distance, ball position, and score.
- The challenge tracks remaining time and final score.
- Reaching the first-down line resets to first-and-10; a failed fourth down shows `TURNOVER ON DOWNS` and starts a new offensive drill.
- Diagonal movement is normalized to the same max speed as cardinal movement.
- End-line movement is clamped; sidelines are live-play boundaries.

## Debug Overlay

Add `?debug=1` to the URL to show the optional debug overlay. It shows FPS, placeholder player world coordinates, draw calls, triangle count, frame time, geometry and texture counts, scene/player mesh counts, material counts, camera mode, camera state, focus position, camera position, cinematic presentation phase, cinematic look target, cinematic formation bounds, exact dead-ball spot, resolved next snap spot, snap lane, hash X positions, and formation origin.

Add `?cameraDebug=1` to show camera debug output, including active presentation shot name, shot progress, orbit/cutaway center, radius, camera position, look target, and restore camera. `?cinematics=brief` enables the optional `prePlayOrbit180` and `touchdownOrbit360` shots; `?cinematics=full` also allows first-down and touchdown fan cutaways when visual crowd presentation is enabled. `?cinematics=off` disables these optional shots. Shot previews can be forced with `?shotPreview=prePlayOrbit180`, `?shotPreview=touchdownOrbit360`, `?shotPreview=firstDownCrowdCutaway`, or `?shotPreview=touchdownCrowdCutaway`.

Add `?poseDebug=1` to show every player's current visual pose intent and locomotion phase.

Add `?fieldAudit=1` to show field geometry validation helpers: authoritative field bounds, inner marking bounds, corner markers, and red highlighting for any painted marking that escapes the field surface.

Add `?formationAudit=1` to show the resolved semantic formation: snap lane, field/boundary side, player positions, lateral/depth offsets, football-position metadata when available, line/backfield/eligibility status, distance from snap, distance from the line of scrimmage, and any validation issues highlighted in red.

Add `?presentationAudit=1` to show the development-only presentation audit for 7v7 preview scenarios. It reports snap lane, audit state, camera mode, presentation phase, visual-bound framing, grounding, helmet attachment and gap checks, frame time, draw calls, triangles, player mesh count, material count, and any presentation validation issues.

Add `?sevenAudit=1` with the explicit 7v7 regression playbook to show the seven-on-seven hardening audit. It reports active play, snap lane, roster count, assignments, route corridor errors, stale engagements, overlap warnings, active presentation event, draw calls, triangles, geometry count, material count, player visual count, and active audio nodes.

Add `?elevenAudit=1` to show the eleven-on-eleven hardening audit. It reports roster counts, line/backfield legality, eligibility, assignments, route corridor errors, overlaps, out-of-bounds players, stale references, current result/event, camera containment, draw calls, triangles, geometry count, material count, player and helmet visual counts, active audio nodes, presentation holds, camera shots, crowd reaction state, and frame time.

Add `?routeAudit=1` to show the development-only route audit overlay for receiver routes. It reports route ID, receiver ID, active segment, distance completed, total route distance, completion percentage, nearest projected route point, and cross-track error in yards.

Add `?passAudit=1` to show the development-only pass audit overlay for route-aware passing. It reports selected receiver, release position, predicted target position, predicted receiver position, predicted route distance, predicted flight time, actual closest approach, horizontal miss distance, ball height at closest approach, and the catch or incompletion reason.

Add `?appearanceAudit=1` to show the development-only player appearance audit. It reports player ID, skin-tone ID, head bounds, helmet bounds, and head-to-helmet clearance.

Add `?audioDebug=1` to show the runtime audio debug overlay. It reports `AudioContext` state, explicit user-gesture unlock state, active buses, gain values, active loops, active one-shots, active audio node/source counts, prepared media-element source count, loaded compressed bytes, estimated decoded buffer bytes, longest loaded clip, decoded versus streamed asset IDs, missing optional local assets, recent audio-observed gameplay events, and unlock errors.
It also reports event history entries with event ID, selected asset, trigger time, played/suppressed status, and suppression reason.

Add `?crowdPreview=1` to show the development crowd preview overlay. It reports requested and actual spectator count, near/far LOD instance counts, crowd draw calls, crowd triangles, geometry/material/texture counts, explicit per-instance storage, estimated instance-buffer bytes, frame-time and FPS measurements, renderer memory counters, benchmark status, and preview camera controls.

Add `?crowdDebug=1` with `?crowdVisuals=1` to show the normal-game crowd presentation overlay. It reports visual/reaction settings, crowd density, spectator count, reaction state, bounded update count, draw calls, triangles, frame time, and the latest crowd event sync.

Add `?presentationAudit=1` during normal gameplay to show the presentation hardening matrix. It reports audio, announcer, captions, crowd visuals, crowd reactions, cinematics, active camera shot, presentation holds, duplicate event suppression, render metrics, and audio memory counters.

The debug readback API also exposes an experience-settings snapshot with the effective preset, persisted profile, explicit query overrides, development-only mode flags, final resolved settings, and audio/crowd asset-readiness summary.

## Current Non-Goals And Future Scope

- Presentation future scope: broader stadium activation, detailed crowd choreography, sideline characters, advertisements, weather, field degradation, turf redesign, and broader stadium presentation are planned later, not permanent exclusions. The current crowd work includes optional normal-game visual crowd presentation plus the development-only rendering and memory preview.
- Roster future scope: 11v11 is now the active normal prototype with one rushing play and one passing play. Additional 11v11 plays, full special teams, roster tiers beyond the current 11v11 prototype and maintained 7v7/5v5 regression modes, player switching, and broader formation families are deferred.
- Assets and animation future scope: imported full-body player models, imported head models, facial features, hair, skeletal animation, quarterback animation, scramble animation, tackling animation, celebration animation, and center or snap animation are deferred. The current prototype intentionally uses procedural low-poly silhouettes, procedural heads, a procedural football, and the reusable low-poly helmet.
- Play calling and setup: no large playbook menu, final title artwork, audibles, defensive play selection, route editor, procedural play generation, hot routes, team selection, roster editing, season mode, save slots, or menus beyond the current title/setup flow, pause settings panel, pre-snap play cards, and minimal HUD/debug displays.
- Passing and ball outcomes: no interceptions, fumbles, loose-ball physics, manual aiming, pass-type selection, pump fake, illegal-forward-pass penalty, referee logic, user-controlled catch mechanic, contested-catch ratings, or quarterback ratings.
- Blocking and tackling: no offensive linemen rules, holding penalties, pancake blocks, double-team blocks, pulling guards, diving tackles, advanced pursuit/pathfinding library, or physics-driven contact.
- Game structure: no quarters, opponent score, halftime, timeouts, NFL clock-stoppage rules, play clock, punts, field goals, penalties, defensive possessions, full game rules, season modes, or franchise systems.
- Controls and camera: no sprinting, stamina, freely rotating camera, camera-relative controls, instant replay, replay recording, slow motion, camera collision, or camera redesign beyond the current tactical, offense-perspective, cinematic broadcast, optional orbit-shot, and optional fan-cutaway presentation modes.
- Audio future scope: no spatial player sounds, music playback, live text generation, second commentator, or browser-side ElevenLabs calls in runtime gameplay. The first runtime MP3 pack is generated and verified locally; future audio work should preserve existing approved assets unless replacement is explicit.
- Simulation architecture: no force-based physics, ragdoll physics, general-purpose physics engine, advanced AI rewrite, or unrelated refactoring.
