# Football JS

Low-poly 3D American football prototype built with Three.js, Vite, and TypeScript.

The long-term target is a stylized low-poly 11v11 American-football game with cinematic and broadcast-style presentation. The normal player-facing mode is now an offense-only exhibition shell: the player controls the user team's offensive possessions, while opponent possessions resolve through a deterministic broadcast-style drive summary. The preserved score-attack mode is a development regression harness for validating controls, play states, formations, ball spotting, passing, tackling, downs, and camera language.

The active default prototype is now a complete twenty-two-player 11v11 offense-only exhibition mode with teams, four configurable quarters, deterministic opening and second-half possession, user offensive drives, abstract punts, simulated opponent drives, automatic extra points, halftime, final score, and game over. It includes Inside Zone 11 and Spread Quick 11. The official in-game title is centralized as `Football JS` in `src/config/GameBrand.ts`, with provisional GPT Image 2 title and emblem artwork selected under `public/branding`. The 7v7 drill is retained as a maintained development regression mode through `?playbook=7v7`, and the legacy 5v5 drill remains available through `?playbook=5v5` and the setup screen when `Development Score Attack` is selected. Development formation preview supports static 7v7 and 11v11 staging. A shared normal-game presentation runtime coordinates authoritative result events across crowd visuals, crowd audio, gameplay effects, announcer commentary, captions, cinematic holds, and camera shots without changing gameplay outcomes. Exhibition starts now pass through the player-facing Match Setup screen, a runtime pregame broadcast presentation phase, and a one-time interactive opening coin toss before playable pre-snap, with stadium/matchup/team/weather shots, presentation-only warmup groups, a user-team starting-quarterback warmup spotlight and showcase card, presentation-only coin-toss captains and referee, a textured 3D ceremonial coin, lower thirds, pre-rendered pregame announcer lines when available, title-music duck/fade, crowd ambience, skip support, and no gameplay or clock advancement until the match flow reaches playable pre-snap. The prototype includes Match Setup team and home/away uniform selection for fictional starter teams, reusable tinted SVG helmet badges, title Settings color customization, validated custom colors, shared team themes applied to player uniforms, helmets, HUD, play cards, end zones, and crowd accents, plus stable fictional roster identities bound to gameplay lineup slots for presentation. It also includes presentation-only quarterback ratings/scouting profiles, a setup roster preview, a retro controlled-player name and number label, a normal-game mathematical low-poly stadium bowl, seat-layout-derived crowd placement, presentation-only sideline teams and tunnel staging, a presentation-only two-official crew, runtime broadcast-announcer playback from local pre-rendered assets, graphical pre-snap SVG play cards generated from gameplay data, visual-only procedural player poses and locomotion, route-aware passing consistency, receiver routes as ordered mathematical paths, pre-snap field route art, development-only field/route/pass/appearance/audio/commentary/crowd/camera/formation/memory/officials/sideline/pregame auditing, low-density normal-game crowd visuals and reactions in the broadcast profile, a procedural football, visible low-poly player heads, and a basic offensive drive: a field generated from a pure field specification with batched static markings, turf bands, yard numbers, goalposts, sideline presentation, selectable play calls, quarterback scrambling with a line-of-scrimmage passing rule, route-running receiver behavior, selected-target passing with a deterministic arc, swept catch detection, downs, yards-to-go, first-down line, touchdown scoring, sack, tackle, incomplete, and out-of-bounds outcomes, turnover-on-downs reset, exact dead-ball spotting with three-lane snap placement, final-score game over, development-only formation preview staging, the preserved orthographic three-quarter camera, the behind-the-offense perspective camera, and the optional cinematic broadcast camera.

Simulated kickoffs now bridge the coin toss, second-half possession, and scoring transitions. They use stable kicker power/accuracy ratings, seeded ball-flight math, presentation-only kickoff formations, visible landing reticles, touchback/fielded-start outcomes, and serialized kickoff announcer lines; playable kicking and returns remain future scope.

## World Scale

- `1 Three.js world unit = 1 yard`.
- The field is `120 x 53.33` units, matching a 100-yard playable field plus two 10-yard end zones.
- The `X` axis runs sideline to sideline, `Z` runs end zone to end zone, and `Y` is vertical.
- Direction of play is positive `Z`.
- The initial line of scrimmage is at `Z = -15`.
- Field dimensions, paint widths, field bounds, playable bounds, and plain layout data are centralized in `src/fieldSpec.ts`.
- Static field markings are batched by material while the line of scrimmage and first-down line remain dynamic.
- Yard numbers face the sidelines, and the presentation-only goalposts sit on the end lines at the back of each end zone.
- Painted hash marks and snap-placement hash lanes share the same widened arcade hash X value derived from the professional hash position.
- World-unit to football-yard conversion is centralized in `src/fieldScale.ts`.

## Runtime Architecture

- `src/main.ts` is a thin bootstrap that constructs and starts `FootballApplication`.
- Application lifecycle owners live under `src/app`: scene/rendering, the game loop, gameplay orchestration, player visual reconciliation, presentation coordination, and development diagnostics are separated.
- Field presentation is split under `src/field` while `src/field.ts` remains the compatibility facade for existing field APIs.
- Camera behavior is split under `src/camera` into configuration, focus resolution, rig mutation, and presentation-shot sequencing modules.
- Crowd preview and normal-game crowd presentation share focused modules under `src/crowd` for layout, mesh construction, reaction state, metrics, and resource ownership.
- Stadium presentation lives under `src/stadium` and defines a pure stadium spec, rounded-rectangle bowl path, row layout, seat layout, material library, geometry builder, and controller. Crowd placement consumes stadium seat transforms rather than a separate seating formula.
- Presentation-only sideline and tunnel team subjects live under `src/presentation/teams`. They use mathematical team/tunnel zones, instanced low-poly visuals, shared materials, deterministic skin tones, and debug/resource metrics without entering gameplay rosters, collision, AI, blocking, coverage, possession, or scoring.
- Presentation-only pregame warmup subjects live under `src/presentation/pregame`. They use mathematical team practice zones, shared/instanced low-poly visuals, a targetable QB clone, warmup football/cone props, and roster-driven QB showcase data without moving authoritative gameplay players.
- Roster identity lives under `src/roster`. Gameplay systems continue to use stable gameplay player IDs, while presentation and UI resolve names, jersey numbers, football positions, and appearance IDs through active lineup bindings.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run audio:plan
npm run audio:generate:sfx
npm run audio:generate:speech
npm run audio:generate:pregame
npm run audio:report
npm run audio:verify
npm run music:plan
npm run music:generate
npm run music:report
npm run branding:plan
npm run branding:generate
npm run branding:report
npm run test:unit
npm run test:smoke
npm test
npm run benchmark:reference
npm run perf:11v11
npm run perf:report
```

Open the dev server at `http://127.0.0.1:5173`.

## Reference Performance Benchmark

Run `npm run benchmark:reference` to build production assets and run the reference Chromium benchmark through `vite preview`, not Vite development mode.

- Viewport: `1920 x 1080`, device scale factor `1`.
- Scenario: 11v11 broadcast profile, offense camera, brief cinematics, procedural player motion, presentation-only officials, low-density measured crowd visuals and reactions, route art enabled, debug overlays disabled.
- Sampling: `3` second warm-up, at least `12` seconds sampled, hidden-tab frames ignored.
- Timing target on hardware rendering: median frame time `<= 16.67 ms`, p95 `<= 18.18 ms`, p99 `<= 33.33 ms`, and no rolling one-second window below `55 FPS`. Primary millisecond reporting uses a `0.05 ms` measurement epsilon for Chromium timestamp granularity.
- `PERF_STRICT=1 npm run test:perf` enforces the strict median/p95/p99 timing gate on hardware-accelerated Chromium. Normal smoke tolerance accepts `55-60 FPS` and fails hardware-rendered runs only when a rolling one-second window remains below `55 FPS`.
- Software rendering such as SwiftShader reports timing but does not fail timing gates; structural budgets still apply.
- Current structural budgets are measured from the passing optimized reference plus margin: `450` draw calls, `250000` triangles, `180` geometries, `90` materials, `32` textures, `390` visible player meshes, `0` shadow casters, `8` crowd draw calls, and `20` stadium draw-call estimate.
- See `docs/PERFORMANCE_GOVERNOR.md` for the adaptive quality policy, strict gate instructions, and gameplay invariants that quality changes may not touch.
- Report output: `test-results/reference-performance-report.json`.
- Presentation-only officials are part of the broadcast benchmark profile; the comparison matrix also keeps an officials-disabled profile for measuring their fixed presentation cost.

## 11v11 Performance Profiling

Run `npm run perf:11v11` to build production assets and profile deterministic 11v11 scenarios in Chromium through `vite preview`.

- Profiling is disabled by default and is activated only with `?perfProfile=1` in the benchmark harness.
- The report covers complete frame time, CPU/presentation phases, `renderer.render`, renderer counters, scene structure, and retained long-frame correlation.
- Scenario reports are written to `test-results/eleven-performance-report.json` with a readable summary in `test-results/eleven-performance-summary.txt`.
- Use `npm run perf:report` to print the latest report summary without rerunning the benchmark.
- For quick local smoke runs, override durations with environment variables such as `FOOTBALL_PERF_SAMPLE_MS=1500`, `FOOTBALL_PERF_COMPARISON_SAMPLE_MS=750`, and `FOOTBALL_PERF_WARMUP_MS=500`.
- Current officials are presentation-only low-poly visuals; the profiling harness records official mesh count and keeps an officials-on/off comparison dimension for cost tracking.
- Measured optimization ownership and before/after evidence lives in `docs/PERFORMANCE_OPTIMIZATION_OWNERSHIP.md`.

## Runtime Memory Profiling

Press `F1` and enable `Memory`, or open with `?memoryDebug=1`, to inspect runtime resource estimates.

- Reports renderer counters, calculated BufferGeometry/index/InstancedMesh bytes, texture estimates, browser memory support, and subsystem ownership groups, including crowd, stadium, presentation officials, and sideline teams.
- Calculated texture and buffer totals are diagnostic estimates from Three.js-visible resources, not exact GPU VRAM usage.
- The crowd capacity test temporarily removes the normal presentation crowd, measures a no-crowd baseline, tests deterministic spectator counts, disposes temporary crowd resources between trials, and recommends a count only for the current browser session.
- `Apply Recommended Count` maps the session recommendation to the existing low/medium/high crowd-density setting; crowd visuals are not automatically enabled.
- Query helpers: `?memoryDebug=1`, `?crowdCapacityCounts=0,500,1000`, `?crowdCapacityTarget=30fps|60fps|custom`, and `?crowdCapacityFrameMs=16.67`.

## Audio Production

ElevenLabs is used for offline generation only. Production browser code must not call ElevenLabs, receive `ELEVENLABS_API_KEY`, or use any `VITE_`-prefixed ElevenLabs secret.

- Official installed skills: `.agents/skills/setup-api-key`, `.agents/skills/sound-effects`, `.agents/skills/text-to-speech`, and `.agents/skills/music`.
- Project skills: `.codex/skills/football-audio-director` and `.codex/skills/football-broadcast-writer`.
- Typed plan: `tools/audio/audioPlan.ts`.
- Broadcast script catalog: `tools/audio/announcerScriptCatalog.ts`.
- Pregame broadcast catalog and generator: `tools/audio/pregameScriptCatalog.ts` and `tools/audio/generatePregameSpeech.ts`.
- Announcer caption manifest and audition page: `public/audio/announcer/announcer-captions.json` and `public/audio/announcer/announcer-audition.html`.
- Pregame caption manifest and audition page: `public/audio/announcer/pregame-captions.json` and `public/audio/announcer/pregame-audition.html`.
- Generated starter pack: two streamed crowd loops, six crowd reactions, seven football one-shots, 27 gameplay announcer speech clips, and 49 pregame broadcast clips.
- Safe local example: `.env.example`.
- Title music plan and report: `tools/audio/musicPlan.ts`, `tools/audio/generateMusic.ts`, and `tools/audio/musicReport.ts`.
- Output roots: `public/audio/sfx`, `public/audio/crowd`, `public/audio/announcer`, and `public/audio/music`.

`npm run audio:generate:sfx`, `npm run audio:generate:speech`, and `npm run audio:generate:pregame` default to dry-run. Paid API calls require direct execution with an explicit `--execute` flag, such as `npx tsx tools/audio/generateSoundEffects.ts --execute --max-files=15`, `npx tsx tools/audio/generateSpeech.ts --execute --max-files=27`, or `npx tsx tools/audio/generatePregameSpeech.ts --execute --max-files=49`; existing files require `--force` to replace.

The richer report can be printed with `npm run audio:report` and written with `npx tsx tools/audio/audioReport.ts --write`. `npm run audio:verify` validates runtime-manifest filenames, non-empty decodable MP3s, duration bounds, provenance sidecars, caption metadata, compressed-size budget, decoded-buffer budget policy, readiness classification, and the audition page at `public/audio/audition-index.html`. The browser runtime mixer consumes local files only. Runtime announcer playback uses the local `public/audio/announcer/*.mp3` and `public/audio/announcer/pregame/*.mp3` files, serializes commentary so clips do not overlap, and shows exact captions when enabled. The title screen streams the selected local `football-js-title` MP3 through the runtime music bus after a user gesture, then ducks and fades it through the pregame presentation handoff. Spatial player sounds, live text generation, second-commentator support, additional pregame segments beyond warmups/QB showcase, and gameplay/dynamic music are queued future tasks.

`npm run music:generate` defaults to dry-run. Paid ElevenLabs Music calls require direct execution with `--execute`, for example `npx tsx tools/audio/generateMusic.ts --execute --max-files=3`. Existing candidate or sidecar files are skipped unless `--force` is supplied. The current generated title-theme candidates are `public/audio/music/football-js-title-a.mp3`, `football-js-title-b.mp3`, and `football-js-title-c.mp3`; candidate A is copied to the stable provisional path `public/audio/music/football-js-title.mp3`. The audition page is `public/audio/music/music-audition.html`, and the selection manifest is `public/audio/music/music-selection.json`. These files are production assets only and the selected title theme streams from the title screen after user gesture unlock.

## Brand Asset Production

OpenAI image generation is used for offline brand artwork only. Production browser code must not call OpenAI, receive `OPENAI_API_KEY`, or use any `VITE_`-prefixed OpenAI secret.

- Brand config: `src/config/GameBrand.ts`.
- Typed plan: `tools/branding/brandAssetPlan.ts`.
- Generation script: `tools/branding/generateBrandImages.ts`.
- Report, gallery, and selection: `tools/branding/brandAssetReport.ts`, `public/branding/brand-gallery.html`, and `public/branding/brand-selection.json`.
- Selected runtime images: `public/branding/football-js-title.webp` and `public/branding/football-js-emblem.webp`.
- Candidate roots: `public/branding/title` and `public/branding/emblem`.
- Safe local example: `.env.example`.

`npm run branding:generate` defaults to dry-run. Paid image generation requires direct execution with `--execute`, for example `npx tsx tools/branding/generateBrandImages.ts --execute --max-files=4`. Existing candidate or sidecar files are skipped unless `--force` is supplied. `npm run branding:report` prints the current report; use `npx tsx tools/branding/brandAssetReport.ts --write` to regenerate the gallery/report files.

## Controls

- A normal launch opens the title screen. Choose `Start Game` to enter the selected prototype and unlock browser audio from that user gesture. Exhibition starts run the pregame broadcast presentation, including presentation-only warmup staging and the user-team starting quarterback showcase when cinematics are enabled, before playable pre-snap; `Space` or `Enter` skips the intro without snapping the ball.
- The opening coin toss now leads into an automatic simulated kickoff before pre-snap. The kickoff is presentation-only: no special-teams controls are active, and the match clock remains stopped until playable offense begins.
- The title screen supports `Broadcast`, `Performance`, and `Custom` presentation profiles plus `Exhibition - Offense Only` and `Development Score Attack` game modes. Exhibition is the normal mode.
- Custom title settings expose quarter length, difficulty, gameplay camera, cinematics, visual crowd, stadium, crowd density, crowd reactions, sideline teams, tunnel tableau, officials, master audio, crowd audio, announcer, captions, quality mode, and team/uniform customization.
- The team setup panel lets you choose fictional user and opponent teams, home or away uniforms, preset swatches, HTML color pickers, custom primary/secondary/helmet/pants/faceguard colors, and reset-to-defaults. Team and uniform changes require returning to the title screen once a match is active.
- The setup screen previews the selected lineup with each active player's jersey number, fictional name, and football position.
- Move with `WASD` or the arrow keys.
- In the default 11v11 prototype, press `1` during pre-snap to select `Inside Zone 11`.
- In the default 11v11 prototype, press `2` during pre-snap to select `Spread Quick 11`.
- Use `?playbook=7v7` or `7v7 Development Regression Mode` to run the maintained seven-on-seven regression drill with Inside Zone 7, Outside Zone 7, Quick Pass 7, and Twin Slants Flat.
- Use `?playbook=5v5` or `5v5 Legacy Regression Mode` to run the preserved five-on-five regression drill.
- Click or tap a pre-snap play card to select that play.
- Press `Space` from pre-snap to start the play and give the player possession.
- In Exhibition mode, press `P` during pre-snap to take an abstract punt. The game switches to a simulated opponent drive summary instead of playing a defensive possession in real time.
- Press `E` before throwing on a passing play to cycle eligible receivers.
- Press `F` during a passing play to throw once toward the selected eligible receiver. The target is predicted from the receiver's current route progress and the ball's deterministic flight time.
- Press `R` to reset the play to pre-snap.
- Press `Enter` on Exhibition transition screens to continue, and press `Enter` from Exhibition game over to rematch. In Development Score Attack, press `Enter` from game over to restart the two-minute challenge.
- Press `C` in development or with `?debug=1` to cycle through tactical orthographic, behind-the-offense perspective, and cinematic broadcast cameras.
- Press `Escape` during pre-snap or dead-ball states to open the settings panel. Volume, captions, camera, cinematics, and crowd settings apply safely where practical; game mode changes require returning to the title screen.
- A plain launch uses the `broadcast` experience preset with the offense-only Exhibition game mode: 11v11 playbook, offense camera, brief pregame/cinematic presentation, mathematical stadium, presentation-only officials, sideline teams, tunnel tableau staging, low-density crowd visuals and reactions, runtime audio, announcer, pre-snap route art, and player motion.
- Use `?experience=broadcast`, `?experience=performance`, or `?experience=custom` to choose the resolved normal-game profile. The `performance` preset keeps the offense camera and player motion but disables cinematics, visual crowd, and crowd reactions.
- Quality mode defaults to `Adaptive 60 FPS`. Use `?quality=adaptive`, `?quality=locked-broadcast`, or `?quality=locked-performance` to override it for a session. Adaptive quality may reduce render pixel ratio immediately at a frame boundary and may reduce crowd presentation only at title, pre-snap, or dead-ball boundaries; it never changes roster size, gameplay simulation, collision, ball trajectory, route progress, drive state, input, or camera focus targets.
- Query parameters such as `?camera=`, `?cinematics=`, `?stadium=`, `?officials=`, `?sidelinePlayers=`, `?sidelineDensity=`, `?tunnelTableau=`, `?crowdVisuals=`, `?audio=`, `?announcer=`, `?captions=`, `?routeArt=`, and `?playerMotion=` are explicit development overrides and do not rewrite persisted experience settings.
- Use `?controlledPlayerLabel=0` to hide the controlled-player nameplate for a session. Use `?selectedReceiverLabel=1` to opt into the same lightweight label system for the selected receiver.
- Use `?cinematics=off`, `?cinematics=brief`, or `?cinematics=full` to control optional orbit-shot presentation for a session. The broadcast preset defaults to `brief`; the performance preset defaults to `off`.
- Use `?shotPreview=prePlayOrbit180`, `?shotPreview=touchdownOrbit360`, `?shotPreview=firstDownCrowdCutaway`, or `?shotPreview=touchdownCrowdCutaway` with `?cameraDebug=1` to inspect presentation shots without changing gameplay rules.
- Add `?cameraDebug=1` to show camera and shot debug output without enabling the broader debug overlay path.
- Press `M` to toggle the temporary runtime audio mute setting after the first user gesture unlocks audio.
- Use `?camera=tactical`, `?camera=offense`, or `?camera=cinematic` to choose the starting camera mode.
- Use `?officials=0` to disable presentation-only officials for a session. Use `?officialsDebug=1` or the F1 debug panel's `Officials` feature to inspect official roles, current targets, positions, and distance from the ball.
- Use `?sidelinePlayers=0` to disable presentation-only sideline teams, `?sidelineDensity=low|medium|high` to choose 4/8/12 sideline players per team, and `?tunnelTableau=0` to hide the current static tunnel tableau. Use `?sidelineDebug=1` or the F1 debug panel's `Sideline teams` feature to inspect counts, zones, draw calls, triangles, instance bytes, and update cadence.
- Use `?audio=0`, `?crowdAudio=0`, or `?announcer=0` to disable runtime audio, crowd-loop playback, or announcer playback paths during development.
- Use `?captions=1` to enable broadcast captions for announcer lines.
- Use `?commentaryDebug=1` to show commentary queue, cooldown, current clip, source event, priority, and crowd duck state.
- The broadcast preset enables the mathematical stadium and the normal-game budgeted visual crowd at low density. Use `?stadium=0` to disable stadium geometry for a session. Use `?crowdVisuals=0` to disable the visual crowd, or `?crowdVisuals=1` to explicitly enable it when using another preset. Use `?crowdDensity=low`, `?crowdDensity=medium`, or `?crowdDensity=high` for benchmarked 500, 2,000, or 5,000 spectator presets. Use `?crowdReactions=0` to keep the crowd static.
- The graphical play cards are visible only during pre-snap and are generated from the same play definitions, resolved formation positions, routes, and blocker assignments used by gameplay.
- Play selection is locked while a play is live; reset preserves the selected play.
- The HUD shows the selected target for passing plays.
- The field shows one pooled retro label for the currently controlled player, using the roster identity and team colors. It transfers with possession after a catch and does not affect collision, targeting, AI, or camera focus.
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

Press `F1` to open the runtime debug panel. It can lazily enable and dispose general metrics, camera, field, formation, route, passing, crowd, sideline teams, memory, audio, presentation, and officials overlays without reloading the page.

Add `?debug=1` to the URL to show the optional debug overlay. It shows FPS, placeholder player world coordinates, draw calls, triangle count, frame time, geometry and texture counts, scene/player mesh counts, material counts, camera mode, camera state, focus position, camera position, cinematic presentation phase, cinematic look target, cinematic formation bounds, exact dead-ball spot, resolved next snap spot, snap lane, hash X positions, and formation origin.

Add `?cameraDebug=1` to show camera debug output, including active presentation shot name, shot progress, orbit/cutaway center, radius, camera position, look target, and restore camera. Normal gameplay presentation does not run crowd cutaways; first downs and out-of-bounds results stay on the exact dead-ball spot, and touchdowns stay on the scorer or end-zone context. `?cinematics=brief` permits the current post-score presentation where the active camera policy allows it, `?cinematics=full` enables fuller development presentation language, and `?cinematics=off` disables optional shots. Crowd cutaway implementations remain available only through explicit development shot previews: `?shotPreview=firstDownCrowdCutaway` or `?shotPreview=touchdownCrowdCutaway`.

Add `?poseDebug=1` to show every player's current visual pose intent and locomotion phase.

Add `?fieldAudit=1` to show field geometry validation helpers: authoritative field bounds, inner marking bounds, corner markers, and red highlighting for any painted marking that escapes the field surface.

Add `?formationAudit=1` to show the resolved semantic formation: snap lane, field/boundary side, player positions, lateral/depth offsets, football-position metadata when available, line/backfield/eligibility status, distance from snap, distance from the line of scrimmage, and any validation issues highlighted in red.

Add `?presentationAudit=1` to show the development-only presentation audit for 7v7 preview scenarios. It reports snap lane, audit state, camera mode, presentation phase, visual-bound framing, grounding, helmet attachment and gap checks, frame time, draw calls, triangles, player mesh count, material count, and any presentation validation issues.

Add `?sevenAudit=1` with the explicit 7v7 regression playbook to show the seven-on-seven hardening audit. It reports active play, snap lane, roster count, assignments, route corridor errors, stale engagements, overlap warnings, active presentation event, draw calls, triangles, geometry count, material count, player visual count, and active audio nodes.

Add `?elevenAudit=1` to show the eleven-on-eleven hardening audit. It reports roster counts, line/backfield legality, eligibility, assignments, route corridor errors, overlaps, out-of-bounds players, stale references, current result/event, camera containment, draw calls, triangles, geometry count, material count, player and helmet visual counts, active audio nodes, presentation holds, camera shots, crowd reaction state, and frame time.

Add `?routeAudit=1` to show the development-only route audit overlay for receiver routes. It reports route ID, receiver ID, active segment, distance completed, total route distance, completion percentage, nearest projected route point, and cross-track error in yards.

Add `?passAudit=1` to show the development-only pass audit overlay for route-aware passing. It reports selected receiver, release position, predicted target position, predicted receiver position, predicted route distance, predicted flight time, actual closest approach, horizontal miss distance, ball height at closest approach, and the catch or incompletion reason.

Add `?appearanceAudit=1` to show the development-only player appearance audit. It reports player ID, skin-tone ID, head bounds, helmet bounds, and head-to-helmet clearance.

Use the F1 debug panel or `?labelDebug=1` to show the roster-label overlay. It reports the controlled gameplay ID, roster player ID, display name, jersey number, label position, visibility reason, and texture-cache size.

Add `?audioDebug=1` to show the runtime audio debug overlay. It reports `AudioContext` state, explicit user-gesture unlock state, active buses, gain values, active loops, active one-shots, active audio node/source counts, prepared media-element source count, loaded compressed bytes, estimated decoded buffer bytes, longest loaded clip, decoded versus streamed asset IDs, missing optional local assets, recent audio-observed gameplay events, and unlock errors.
It also reports event history entries with event ID, selected asset, trigger time, played/suppressed status, and suppression reason.

Use the F1 debug panel or `?officialsDebug=1` to show the officials overlay. It reports each official ID, semantic role, current position, target position, distance from the authoritative ball position, and update state.

Use the F1 debug panel or `?sidelineDebug=1` to show the sideline teams overlay. It reports active sideline and tunnel counts, density, draw calls, triangles, instance-buffer bytes, update frequency, team zones, tunnel zones, and visible mesh count.

Add `?crowdPreview=1` to show the development crowd preview overlay. It reports requested and actual spectator count, near/far LOD instance counts, crowd draw calls, crowd triangles, geometry/material/texture counts, explicit per-instance storage, estimated instance-buffer bytes, frame-time and FPS measurements, renderer memory counters, benchmark status, and preview camera controls.

Add `?crowdDebug=1` with `?crowdVisuals=1` to show the normal-game crowd presentation overlay. It reports visual/reaction settings, crowd density, spectator count, reaction state, bounded update count, draw calls, triangles, frame time, and the latest crowd event sync.

Add `?qualityDebug=1` to show adaptive-quality state: quality mode, current tier, pixel ratio, rolling median, rolling p95, current FPS, recent downgrade/upgrade reason, pending safe-boundary transition, and latest profiler limiting subsystem when profiling is active.

Add `?presentationAudit=1` during normal gameplay to show the presentation hardening matrix. It reports audio, announcer, captions, crowd visuals, crowd reactions, cinematics, active camera shot, presentation holds, duplicate event suppression, render metrics, and audio memory counters.

The debug readback API also exposes an experience-settings snapshot with the effective preset, persisted profile, explicit query overrides, development-only mode flags, final resolved settings, and audio/crowd asset-readiness summary.

## Current Non-Goals And Future Scope

- Presentation future scope: detailed stadium architecture, detailed crowd choreography, coaches, chain crew, advertisements, weather, field degradation, turf redesign, animated scoreboard video, and broader stadium polish are planned later, not permanent exclusions. The current presentation work includes an active mathematical stadium bowl, optional normal-game visual crowd presentation, presentation-only sideline teams and tunnel staging, and the development-only rendering and memory preview.
- Roster future scope: 11v11 is now the active normal prototype with one rushing play and one passing play. The current roster layer provides fictional starter identities, specialists, setup preview, and active-lineup presentation binding. Additional 11v11 plays, full special teams behavior, depth-chart editing, substitutions, injuries, recruiting, roster tiers beyond the current 11v11 prototype and maintained 7v7/5v5 regression modes, player switching, and broader formation families are deferred.
- Assets and animation future scope: imported full-body player models, imported head models, facial features, hair, skeletal animation, quarterback animation, scramble animation, tackling animation, celebration animation, and center or snap animation are deferred. The current prototype intentionally uses procedural low-poly silhouettes, procedural heads, a procedural football, and the reusable low-poly helmet.
- Play calling and setup: no large playbook menu, final title artwork, real team logos, audibles, defensive play selection, route editor, procedural play generation, hot routes, depth-chart editing, season mode, save slots, or menus beyond the current title/setup flow, team customization panel, roster preview, pause settings panel, pre-snap play cards, and minimal HUD/debug displays.
- Passing and ball outcomes: no interceptions, fumbles, loose-ball physics, manual aiming, pass-type selection, pump fake, illegal-forward-pass penalty, officiating authority or penalty logic, user-controlled catch mechanic, contested-catch ratings, or quarterback ratings affecting gameplay.
- Blocking and tackling: no offensive linemen rules, holding penalties, pancake blocks, double-team blocks, pulling guards, diving tackles, advanced pursuit/pathfinding library, or physics-driven contact.
- Game structure future scope: no playable defense, playable field goals, playable punts or kickoffs, overtime, timeouts, NFL clock-stoppage rules, play clock, penalties, season modes, or franchise systems. The current Exhibition shell already includes four quarters, user score, opponent score, halftime, abstract punts, simulated opponent possessions, and final score.
- Controls and camera: no sprinting, stamina, freely rotating camera, camera-relative controls, instant replay, replay recording, slow motion, camera collision, or camera redesign beyond the current tactical, offense-perspective, cinematic broadcast, optional orbit-shot, and development-only cutaway preview modes.
- Audio future scope: no spatial player sounds, gameplay music, dynamic music, live text generation, second commentator, or browser-side ElevenLabs calls in runtime gameplay. The first runtime MP3 pack and provisional title-theme candidates are generated and verified locally; the title screen now streams the selected local theme after user gesture unlock. Future audio work should preserve existing approved assets unless replacement is explicit.
- Simulation architecture: no force-based physics, ragdoll physics, general-purpose physics engine, advanced AI rewrite, or unrelated refactoring.
