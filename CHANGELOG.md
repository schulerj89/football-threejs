# Changelog

All notable changes to this project will be documented in this file.

## [1.21.25] - 2026-06-23

### Fixed

- Reduced the 3D coin size for midfield coin-toss staging.
- Updated the coin-toss animation so the coin arcs upward, lands at turf height, and finishes flat with the resolved face up.

### Tests

- Verified `npx vitest run tests/coinToss.test.ts`, `npx tsc --noEmit --pretty false`, and `npm run build`.

## [1.21.24] - 2026-06-23

### Fixed

- Added pointer-click skipping for the pregame cinematic sequence, sending the match directly into the coin toss through the same lifecycle path as keyboard skip.
- Prevented delayed voice-pack pregame announcer clips from starting after a skip or reset, so stale intro speech cannot bleed into coin toss audio.

### Tests

- Verified `npx vitest run tests/pregamePresentation.test.ts`, `npx tsc --noEmit --pretty false`, `npm run build`, and `npx playwright test tests/scene-smoke.spec.ts -g "shows the title screen"`.

## [1.21.23] - 2026-06-23

### Fixed

- Required an explicit pre-snap play-card or number-key selection before the quarterback cadence can reach Hut or snap-release.
- Added a `CHOOSE A PLAY` cadence HUD/debug state so the default gameplay play cannot be silently hiked after a formation reset.

### Tests

- Verified `npx vitest run tests/preSnapCadenceModel.test.ts`, `npx tsc --noEmit --pretty false`, and `npm run build`.

## [1.21.22] - 2026-06-23

### Fixed

- Removed the extra circular possession marker from the broadcast scorebug lower strip now that timeout indicators render beneath the team scores.

### Tests

- Verified `npx vitest run tests/broadcastScorebug.test.ts`, `npx tsc --noEmit --pretty false`, and `npm run build`.

## [1.21.21] - 2026-06-23

### Added

- Added a scorebug layout preview harness at `public/branding/scorebug/scorebug-layout-preview.html` with mirrored safe-zone measurements and dynamic timeout pips.
- Added roster-driven front jersey-number anchors and decals that share the existing jersey-number atlas/material pipeline with back numbers.

### Changed

- Generated and selected a new GPT Image 2 broadcast scorebug shell, then retuned HTML overlay safe zones for larger team logos, centered scores/timeouts, stacked quarter/time, and aligned lower-strip context.
- Updated Play Now team cards to emphasize larger centered team logos, stronger team-color accents, and rating chips while removing quarterback-specific text from that matchup screen.

### Fixed

- Removed the old procedural front jersey-number texture block so front numbers no longer show a square panel behind them.
- Preserved transparent scorebug shell runtime rendering so the generated opaque image background does not show around the broadcast package.

### Tests

- Verified `npx vitest run tests/broadcastScorebug.test.ts tests/brandAssets.test.ts tests/playerVisual.test.ts tests/presentation/players/footballPlayerVisualFactory.test.ts`, `npx tsc --noEmit --pretty false`, and `npm run build`.

## [1.21.20] - 2026-06-23

### Added

- Added a development-only `player-lab.html` entry for inspecting the shared football-player visual, editing procedural pose presets, previewing pose blends/clips, and exporting/importing pose JSON.
- Added reusable `PlayerPoseApplier` pose data, validation, interpolation, and procedural visual application helpers for future animation integration.
- Added lab-only visual helper toggles for pivots, bounds, foot contacts, joint labels, helmet bounds, number anchor, and optional football attachment.

### Tests

- Verified `npx tsc --noEmit --pretty false`, `npx vitest run tests/playerPoseLab.test.ts`, `npx playwright test tests/player-lab.spec.ts`, `npm run build`, and `npm run test:unit`.
- Ran `npm run test:smoke`; the new player-lab route passed, while existing normal-game smoke failures remain in crowd-audit/cadence flows outside this lab change.

## [1.21.19] - 2026-06-23

### Changed

- Replaced remaining black sideline and warmup silhouettes with roster-backed full football-player presentation clones.
- Extended the place-kick result hold so made field goals/PATs remain on screen long enough to read and hear.

### Fixed

- Added a visible kicker run-up toward the holder before place-kick contact.
- Added made-kick feedback with a whistle, an optional announcer “It’s good!” call, and a clean result banner instead of showing the timing meter after the kick.
- Held successful place-kick ball visuals at the goal plane during the result moment so the ball visibly clears the uprights.

### Tests

- Verified `npx tsc --noEmit` and `npx vitest run tests/specialTeams/placeKick.test.ts` during implementation.

## [1.21.18] - 2026-06-23

### Changed

- Replaced the Play Now 3D helmet preview with team logos and removed the preview renderer from the title/hub lifecycle.
- Updated Play Now team selectors so each side omits the team currently selected by the other side, including previous/next navigation.

### Fixed

- Restored the previous committed helmet asset path after the experimental helmet did not fit player heads.
- Prevented the same-team validation message from appearing in normal Play Now selection by avoiding invalid options up front.

### Tests

- Verified `npm run build`, `npx vitest run tests/matchSetup.test.ts`, `npx vitest run tests/matchSetup.test.ts tests/helmetVisual.test.ts tests/meshy/helmetPipeline.test.ts`, and `npx playwright test tests/scene-smoke.spec.ts -g "shows the title screen, opens football hub, and starts pregame from Play Now"`.

## [1.21.17] - 2026-06-23

### Changed

- Simplified the Rosters page so it focuses on the team logo, roster table, and player details instead of repeating helmet previews, starting quarterback, and best-player summary cards.

### Fixed

- Hid the Play Now SVG helmet fallback layer once the shared GLB helmet preview loads so no fallback/logo shape appears behind the 3D helmet.
- Added spacing and a divider to the compact Rosters header so team identity and roster-size text no longer crowd each other.

### Tests

- Verified `npm run build` and `npx playwright test tests/scene-smoke.spec.ts --grep "shows the title screen, opens football hub, and starts pregame from Play Now"`.

## [1.21.16] - 2026-06-23

### Changed

- Consolidated normal matchup selection into the Play Now flow, removed the duplicate Match Setup screen, and kept roster/team overview browsing separate from active matchup state.
- Reworked Match Setup/Play Now helmet previews around the shared helmet asset path with corrected shell, facemask, normals, and team-color material handling.
- Updated coin-toss captain staging to use stable roster-backed full player visuals with correct spacing, helmets, faceguards, and no normal officials.
- Added deterministic match-seed generation for exhibition flow and voice/presentation selection stability.

### Fixed

- Rounded player-facing football yardage so down-distance and gained-yard text no longer show decimal yards.
- Let touchdown scorers visibly enter the end zone while preserving the official goal-line touchdown spot and yardage.
- Added mathematically placed rectangular end-zone pylons at every goal-line and end-line sideline corner.

### Tests

- Verified `npx vitest run tests/playState.test.ts tests/fieldSpec.test.ts tests/fieldGeometry.test.ts tests/playerSimulation.test.ts`, `npx vitest run tests/fieldSpec.test.ts tests/fieldGeometry.test.ts`, `npx vitest run tests/broadcastScorebug.test.ts`, `npx tsc --noEmit`, and `npm run build`.

## [1.21.15] - 2026-06-23

### Changed

- Replaced anonymous sideline reserve silhouettes in the normal sideline controller with roster-backed `football-player-v1` presentation clones using real team uniforms, jersey numbers, helmet colors, and faceguards.
- Bound sideline rows to actual team reserve/specialist roster identities first, only falling back to non-field starters when higher sideline density needs more bodies.
- Added sideline debug snapshot fields for roster IDs and full football-player visual counts.

### Tests

- Verified `npx vitest run tests/presentation/sideline/sidelineTeams.test.ts tests/pregamePresentation.test.ts`, `npx vitest run tests/specialTeams/kickoff.test.ts tests/halftimePresentation.test.ts`, `npx vitest run tests/stadium/stadiumGeometry.test.ts tests/weather/weatherPresentation.test.ts tests/controlledPlayerLabel.test.ts`, `npx tsc --noEmit`, and `npm run build`.

## [1.21.14] - 2026-06-23

### Fixed

- Replaced the flashing stadium inner-apron workaround with a lower-bowl closure mesh that starts outside the field footprint and ties into the stadium path.
- Closed lower-bowl seating gaps with deterministic riser geometry so the clear sky no longer shows through the bottom of the stadium shell.
- Wired the stiff run animation into kickoff and kickoff-return presentation participants, including the kicker run-up and moving return blockers/coverage players.
- Removed oversized halftime team logos from the stats overlay and kept team identity through compact primary/secondary color chips.

### Tests

- Verified `npx vitest run tests/stadium/stadiumGeometry.test.ts tests/weather/weatherPresentation.test.ts`, `npx vitest run tests/specialTeams/kickoff.test.ts`, `npx vitest run tests/halftimePresentation.test.ts`, and `npm run build`.

## [1.21.13] - 2026-06-23

### Fixed

- Restored controlled-player roster labels after kickoff, PAT, coin toss, and halftime presentation stages by letting the label renderer re-enable its parent group whenever gameplay resumes.

### Tests

- Verified `npx vitest run tests/controlledPlayerLabel.test.ts` and `npm run build`.

## [1.21.12] - 2026-06-23

### Changed

- Added a short post-catch tackle grace window so kickoff returns cannot end immediately before blockers transition.
- Expanded post-catch blocker targeting and added deterministic blocker-vs-coverage engagement collision so assigned defenders cannot pass through return blockers into the returner.

### Tests

- Verified `npx vitest run tests/specialTeams/kickoff.test.ts tests/specialTeams/placeKick.test.ts` and `npm run build`.

## [1.21.11] - 2026-06-23

### Changed

- Staged kickoff-return blockers in deterministic lanes outside the returner catch bubble so receiving blockers no longer converge on the exact catch point before the ball is fielded.

### Tests

- Verified `npx vitest run tests/specialTeams/kickoff.test.ts tests/specialTeams/placeKick.test.ts` and `npm run build`.

## [1.21.10] - 2026-06-23

### Changed

- Made stadium shell materials double-sided and added a low-cost inner apron floor/backing wall so the clear blue sky no longer shows through the lower bowl from field-facing cameras.

### Tests

- Verified `npx vitest run tests/stadium/stadiumGeometry.test.ts tests/weather/weatherPresentation.test.ts` and `npm run build`.

## [1.21.9] - 2026-06-23

### Changed

- Kept receiving blockers visible during automated kickoff returns by moving them into deterministic escort lanes instead of letting them disappear into distant coverage assignments.
- Updated the pregame team-intro matchup overlay to show the registered team logos instead of generic helmet badges.

### Tests

- Verified `npx vitest run tests/specialTeams/kickoff.test.ts tests/specialTeams/placeKick.test.ts`, `npx vitest run tests/pregamePresentation.test.ts tests/specialTeams/kickoff.test.ts`, and `npm run build`.

## [1.21.8] - 2026-06-23

### Changed

- Fixed the full audio audition index so it uses local relative audio paths and can be opened directly without broken `/audio/...` references.
- Added play-all, stop, preload metadata, and available-clip count controls to the full audition index.
- Scoped audio verification to the generated local pregame assets so voice-pack-only pregame placeholders no longer mark runtime audio readiness as partial.
- Regenerated the audio audition index, readiness manifest, and verification report.

### Tests

- Verified `npm run audio:verify`, a local link check for 111 audition controls with zero missing files, `npx vitest run tests/audioRuntime.test.ts tests/audioPipeline.test.ts tests/pregameCommentaryCatalog.test.ts tests/voicePacks.test.ts`, and `npm run build`.

## [1.21.7] - 2026-06-23

### Changed

- Mapped generated player-specific pregame quarterback intro clips into the runtime catalog so Metro, Lakefront, Summit, and Bay City starting QBs use their named audio lines during the QB spotlight.
- Added a local pregame-audio availability gate so missing compact/generic placeholder IDs are no longer registered as local MP3 assets or used as static fallback playback.
- Kept compact voice-pack lines as fallback when a starting quarterback does not have a generated player-specific intro yet.

### Tests

- Verified QB spotlight resolution for named generated QB intro clips, `npx vitest run tests/audioRuntime.test.ts tests/pregameCommentaryCatalog.test.ts tests/voicePacks.test.ts tests/audioPipeline.test.ts`, and `npm run build`.

## [1.21.6] - 2026-06-23

### Changed

- Fixed the announcer and pregame audition HTML pages so audio controls use local relative paths, making them work when opened directly from disk or through the dev server.
- Added play-all and stop controls to the audition pages for faster review.
- Updated the pregame audition page to list every generated pregame MP3 sidecar, including legacy matchup and quarterback-specific assets, instead of only the current compact runtime catalog.

### Tests

- Verified local audition-page links for 27 announcer clips and 84 pregame clips, `npx vitest run tests/audioPipeline.test.ts tests/pregameCommentaryCatalog.test.ts`, and `npm run build`.

## [1.21.5] - 2026-06-23

### Changed

- Regenerated the three Grant Mercer pregame welcome clips so the announcer introduces himself in first person, with refreshed captions, sidecars, and audition metadata.
- Increased coin-toss captain spacing to keep same-team representatives from standing too close together at midfield.
- Changed play-card selection so the tray hides after a play is selected and returns on the next pre-snap sequence.
- Made kickoff and kickoff returns fully automatic, removed user movement control from returns, and flipped fielded-return camera framing behind the return direction.
- Made PAT/place-kick timing automatic in normal play while keeping the existing kick meter implementation available for focused UI tests.

### Tests

- Verified `npx vitest run tests/pregameCommentaryCatalog.test.ts`, `npx vitest run tests/specialTeams/kickoff.test.ts tests/specialTeams/placeKick.test.ts`, focused play-card browser coverage, `npx vitest run tests/coinToss.test.ts`, and `npm run build`.

## [1.21.4] - 2026-06-23

### Added

- Added the six-team league data path, football hub, roster browser, broadcast scorebug shell integration, expanded special-teams flow, halftime presentation, voice-pack loading, weather presentation, jersey numbers, and score/stat presentation foundations.
- Added generated and prepared presentation/audio/branding assets for special teams, cadence, voice packs, team identity, scorebug, helmets, and player-model pipeline work.

### Changed

- Shifted the normal player flow through title, hub, matchup setup, pregame, coin toss, kickoff, cadence, scrimmage, halftime, and game-over presentation.
- Updated the title screen to keep only the Start Game action and moved settings access into the hub.
- Hid matchup helmet preview canvases after Play Game so they no longer remain over gameplay.
- Removed pregame QB-intro football props and the QB clone's held football so the spotlight presents no duplicate footballs.

### Tests

- Verified `npm run build`, targeted pregame/unit coverage, and focused browser smoke coverage for the title-to-hub/match-setup path.

## [1.21.3] - 2026-06-22

### Changed

- Trimmed the default browser smoke gate by moving legacy 5v5, staged 7v7, preview/audit-only, and old score-attack browser probes behind an opt-in extended smoke lane.
- Shortened default title/setup and 11v11 reset-cycle stress counts while preserving the previous deeper counts in extended smoke.
- Narrowed the default F1 debug-panel smoke to registry visibility and representative helper disposal instead of toggling every debug feature through the browser.
- Added `npm run test:smoke:extended` for intentionally running the broader legacy/development browser coverage when needed.

### Tests

- Verified `npm run build`, `npm run test:unit`, `npm run test:smoke`, and `npm run test:smoke:extended -- "keeps the 5v5 legacy"`.

## [1.21.2] - 2026-06-22

### Changed

- Optimized the default `npm run perf:11v11` command into a shorter production smoke benchmark that samples representative 11v11 states and one isolation comparison per profile.
- Preserved the full long-running reference matrix behind `npm run perf:11v11:full` for release profiling and deeper performance investigations.

### Tests

- Verified `npx vitest run tests/referenceBenchmark.test.ts tests/performanceProfiler.test.ts` and `npm run perf:11v11`.

## [1.21.1] - 2026-06-22

### Changed

- Hardened the 11v11 resource-stability audit so reset cycling now exercises every active 11v11 play instead of repeatedly testing only the currently selected play.
- Added debug-only playbook presentation warm-up before reset-cycle baselines so first-use route-art/card material allocation is separated from true resource leaks.

### Tests

- Added browser smoke assertions that the 11v11 audit loop covers all six normal plays: `Inside Zone 11`, `Spread Quick 11`, `Outside Zone 11`, `Off Tackle 11`, `Twin Slants 11`, and `Curl Flat 11`.
- Verified `npx vitest run tests/playbook.test.ts tests/playState.test.ts tests/elevenOnElevenAudit.test.ts`, `npm run test:unit`, `npm run build`, `npx playwright test tests/scene-smoke.spec.ts --grep "shows the title screen|runs eleven-on-eleven audit"`, and `npm run test:smoke`.

## [1.21.0] - 2026-06-22

### Added

- Added `Twin Slants 11` and `Curl Flat 11` to the normal 11v11 playbook as shortcuts `5` and `6`, preserving the existing shortcut order for `Inside Zone 11`, `Spread Quick 11`, `Outside Zone 11`, and `Off Tackle 11`.
- Added data-defined ordered routes, one-to-one pass protection, explicit coverage assignments, deep safety help, and play-card route/protection diagrams for both new passing plays.

### Changed

- Expanded the 11v11 hardening matrix and play-card expectations from four plays to six plays while keeping 7v7 and 5v5 regression modes unchanged.

### Tests

- Added focused coverage for new pass-route resolution across snap lanes, slant break ordering, curl/flat high-low distinction, receiver cycling, deterministic sack/incompletion/reset behavior, and numeric shortcuts `5` and `6`.
- Verified `npx vitest run tests/playbook.test.ts tests/playState.test.ts tests/playCallDiagram.test.ts tests/elevenOnElevenAudit.test.ts`, `npm run test:unit`, `npm run build`, and `npm run test:smoke`.

## [1.20.0] - 2026-06-22

### Added

- Added `Outside Zone 11` and `Off Tackle 11` to the normal 11v11 playbook as shortcuts `3` and `4`, preserving `1` for `Inside Zone 11` and `2` for `Spread Quick 11`.
- Added a field-side semantic 11v11 run formation variant for the new rushing plays so running back alignment, field-side tackle, tight end, field-side receiver, lane targets, and play-card run arrows mirror correctly at left hash, middle, and right hash.

### Changed

- Kept the new rushing plays data-defined with explicit one-to-one assignments, no duplicate initial blockers, no pulling blockers, no double teams, safeties initially unblocked for Outside Zone 11, and one second-level defender unblocked for Off Tackle 11.
- Updated 11v11 play-card expectations and audit coverage so all four normal play cards are generated from real formation, lane-target, and assignment data.

### Tests

- Added focused playbook, play-state, play-card, and 11v11 audit coverage for 22-player creation, running-back possession, snap-lane mirroring, unique assignments, reset stability, and blocker diagram references.
- Verified `npx vitest run tests/playbook.test.ts tests/playState.test.ts tests/playCallDiagram.test.ts tests/elevenOnElevenAudit.test.ts`, `npm run test:unit`, `npm run build`, and `npm run test:smoke`.

## [1.19.0] - 2026-06-22

### Added

- Added play-call diagram route models with ordered SVG route points and visible route-break points sourced from the same `ResolvedReceiverRoute` data used by receiver simulation and on-field route art.
- Added clearer pre-snap play-call tray presentation with a `Choose a Play` heading, run/pass badges, keyboard shortcut labels, selected-card scrolling, desktop 3 by 2 layout support for six plays, and horizontal small-screen card scrolling.

### Changed

- Updated play-card SVGs to draw every receiver route segment with one endpoint arrowhead, rounded joins/caps, marker padding, distinct run arrows, distinct run-blocking and pass-protection styling, assignment target IDs, and a fixed snap-relative scale across current plays and hash lanes.
- Kept pointer play-card selection on the existing request path while preserving number-key selection and live-play selection locking.

### Tests

- Expanded play-call diagram tests for exact resolved route points, route break ordering, SVG bounds, fixed snap-relative scale, left/right hash mirroring, assignment references, run/pass style metadata, six-card layout metadata, and accessible play-card labels.
- Verified `npx vitest run tests/playCallDiagram.test.ts`, `npm run test:unit`, `npx tsc --noEmit`, `npm run build`, and `npm run test:smoke`.

## [1.18.0] - 2026-06-22

### Added

- Added a runtime Football JS menu-music playlist controller that streams all generated menu tracks, auto-advances, supports sequential or deterministic shuffle order, preserves the active track across title, Match Setup, and Settings screens, and exposes previous/next controls through a compact now-playing indicator.
- Added event-driven in-game transition audio foundations with short tracked stingers and crowd-bus stadium chants, including live-play suppression, announcer/stinger suppression for chants, one-chant-per-drive limiting, cooldowns, and F1/audio-debug readback.
- Added player settings for music enabled/disabled and menu playlist order, with versioned migration and persisted settings support.

### Changed

- Registered the expanded generated music/stinger/chant pack in the runtime audio manifest while keeping menu tracks streamed and short stingers/chants as buffered one-shots.
- Kept title/menu music on the existing music bus and preserved the existing pregame duck/fade handoff so continuous music stops before playable pre-snap.

### Tests

- Added focused runtime music tests for menu auto-advance, previous/next controls, stinger live-play suppression, stinger overlap suppression, chant drive limits, and announcer/stinger chant suppression.
- Verified `npx vitest run tests/musicRuntime.test.ts`, `npm run test:unit`, `npx tsc --noEmit`, `npm run build`, and `npm run test:smoke`.

## [1.17.0] - 2026-06-22

### Added

- Generated an expanded Football JS audio-production pack with three new `music_v2` menu playlist tracks, six `music_v2` transition stingers, and three `eleven_text_to_sound_v2` stadium chant layers, all with provenance sidecars.
- Added `public/audio/music/music-catalog.json` and regenerated the grouped music audition/report artifacts for menu tracks, stingers, and chants.

### Changed

- Extended the Node-only music generation pipeline so per-asset durations drive `music_v2` requests and chant assets route through the sound-effects generation path while preserving dry-run defaults, `--execute`, `--force`, retry, and skip-existing behavior.
- Updated audio documentation and ignore rules for the expanded offline music/stinger/chant workflow.

### Tests

- Added music-pipeline coverage for expanded pack validation, sound-effect routed chant generation, and grouped catalog/audition output.
- Verified `npx vitest run tests/musicPipeline.test.ts tests/audioPipeline.test.ts`, `npx tsc --noEmit`, `npm run build`, and `npm run test:smoke`.

## [1.16.0] - 2026-06-22

### Added

- Added presentation-only head coaches for both teams, rendered through bounded instanced low-poly coach parts with team-colored jackets, caps, headset silhouettes, clipboards, deterministic skin tones, and no gameplay authority.
- Added sideline coach/reaction state driven only by authoritative presentation events, plus semantic debug camera targets for user/opponent sideline groups and coaches.
- Added a `coachesEnabled` experience setting, `?coaches=0|1` override, title Settings checkbox, and schema migration.

### Changed

- Updated sideline reserve densities to 5/10/15 players per team and kept reserve, coach, and tunnel subjects inside mathematical team-box zones outside the playable field.
- Extended sideline debug/resource snapshots to report coach count, coach states, reaction state, last reaction event, semantic targets, and active reserve settings.

### Tests

- Added/updated sideline layout, visual-resource, no-gameplay-authority, reaction-deduplication, settings, and pregame fixture coverage for coaches and the new reserve counts.

## [1.15.0] - 2026-06-22

### Added

- Added visual crowd fullness profiles (`sparse`, `standard`, `full`) with the broadcast profile now using a measured full-stadium presentation: 500 reacting lower-bowl spectators plus 4,500 static seat-mosaic spectators.
- Added a static far/upper-bowl crowd mosaic generated from stadium `SeatLayout` transforms, preserving deterministic section occupancy without adding gameplay objects or per-spectator `Object3D`s.

### Changed

- Reworked normal crowd presentation so reactions update only the bounded near InstancedMesh tier while the far mosaic remains static, reducing dynamic instance-buffer uploads at higher visual fullness.
- Updated runtime/debug/resource metrics, memory profiling, crowd preview, adaptive-quality settings, and reference performance budgets to account separately for near instance buffers and static crowd-mosaic buffers.

### Tests

- Added deterministic crowd-distribution and static-mosaic regression coverage, updated browser smoke/readback expectations, and verified the full unit suite, production build, browser smoke suite, and reference performance benchmark.
- Measured the current pre-change crowd cost at 500, 2,000, and 5,000 spectators; the final reference profile passes at 5,000 visible seats with 5 crowd draw calls, 40,000 crowd triangles, 152,000 dynamic instance bytes, and 108,000 static mosaic bytes.

## [1.14.0] - 2026-06-22

### Added

- Added a player-facing Match Setup step between the Football JS title and pregame presentation, with registry-backed user/opponent team selection, home/away uniform selection, reusable tinted SVG helmet badges, team abbreviations, color swatches, and starting-quarterback identity.
- Added explicit previous/next controls for team and uniform selection while preserving pointer, keyboard, and select-based navigation.

### Changed

- Updated the title Start Game action to open Match Setup and renamed the matchup confirmation action to `Play Game`.
- Moved color customization out of Match Setup and into title Settings as profile editing without a second active matchup selector.

### Tests

- Updated browser smoke coverage for Start Game -> Match Setup -> Play Game -> pregame, registry-backed team options, helmet color updates, same-team validation, back navigation, and title/setup cycling.

## [1.13.1] - 2026-06-22

### Changed

- Hardened the normal Exhibition opening sequence so the brief pregame flow now consistently runs stadium establish, matchup, weather, quarterback showcase, coin toss, opening kickoff, and playable possession handoff before pre-snap.
- Guarded opening kickoff scheduling so the coin-toss handoff cannot queue a second kickoff after the match phase has already advanced.
- Clarified that normal post-play presentation stays on the dead-ball spot, scorer, or kickoff/gameplay focus; crowd cutaway shots remain available only through explicit development shot-preview tooling.

### Tests

- Expanded kickoff unit coverage for user/opponent toss winners, touchback and fielded-kick possession starts, second-half kickoff idempotency, and serialized kickoff commentary.
- Strengthened pregame and browser smoke coverage for the weather shot, debug-free plain launch, repeated title/setup cycling, title -> setup -> pregame -> coin toss -> kickoff -> pre-snap flow, and normal presentation readiness.

## [1.13.0] - 2026-06-22

### Added

- Added deterministic simulated kickoff transitions for opening kickoffs, second-half kickoffs, and post-score kickoffs using seeded kicker power/accuracy formulas, controlled ball arcs, landing targets, touchbacks, and abstract fielded-return start spots.
- Added presentation-only kickoff formation staging, a reusable football flight presentation, a visible landing reticle tied to the authoritative kickoff target, and serialized kickoff-ready, kick-away, and kickoff-result announcer sequencing.
- Added stable kicker ratings to roster specialists and F1 kickoff debug readback for kicker identity, ratings, target, landing type, reticle state, ball position, and commentary.

### Changed

- Updated exhibition match flow so the coin toss hands off to kickoff before user pre-snap or opponent-drive simulation, while scoring transitions schedule a single kickoff instead of jumping directly to the next possession.
- Normalized fielded kickoff start spots into the existing drive-coordinate convention while preserving physical landing targets for the visible reticle and ball flight.

### Tests

- Added special-teams unit coverage for deterministic variation, power/accuracy spread, kickoff arc sampling, reticle synchronization, touchbacks, fielded starts, possession handoff, and post-score kickoff deduplication.
- Updated browser smoke coverage for the title/setup/pregame/coin-toss/kickoff/pre-snap flow.

## [1.12.0] - 2026-06-22

### Added

- Added an interactive opening coin-toss match phase between pregame presentation and playable pre-snap, with pointer/keyboard HEADS/TAILS selection, deterministic seeded results, opening/second-half possession state, and a stable midfield presentation shot.
- Added presentation-only coin-toss captains, a referee, a textured low-poly 3D coin using the generated Football JS coin faces, serialized coin-toss announcer setup/result lines, captions, and F1 debug readback.

### Changed

- Updated the normal title -> Match Setup -> pregame flow so pregame now hands off to the one-time opening coin toss before gameplay begins.

### Tests

- Added deterministic coin-toss unit coverage for seeded fairness, required player selection, possession assignment, presentation authority separation, announcer serialization, reset behavior, and score-attack isolation.
- Updated browser smoke coverage for the title/setup/pregame/coin-toss handoff and verified the unit suite, production build, and smoke suite.

## [1.11.0] - 2026-06-22

### Added

- Added a Node-only GPT Image 2 coin asset pipeline for Football JS ceremonial heads/tails image generation with dry-run defaults, explicit paid execution, overwrite protection, provenance sidecars, reports, and an HTML gallery.
- Generated two matching WebP coin-face candidate sets under `public/branding/coin` and selected candidate B as the provisional stable runtime heads/tails pair.
- Added stable runtime coin texture paths at `public/branding/coin/football-js-coin-heads.webp` and `public/branding/coin/football-js-coin-tails.webp`.

### Tests

- Added brand-pipeline unit coverage for the coin plan, dry-run behavior, missing-key failure, existing-file protection, reference-backed tails generation, report/gallery writing, runtime selection, and browser-secret scanning.
- Verified the full unit suite, production build, and browser smoke suite.

## [1.10.0] - 2026-06-22

### Added

- Added an expanded Grant Mercer pregame announcer catalog for warmup transitions, trait-aware quarterback scouting, coin toss setup/results, kickoff readiness, kick-in-flight calls, and kickoff result calls.
- Generated 35 new ElevenLabs pregame announcer MP3 assets with exact captions and provenance sidecars under `public/audio/announcer/pregame`.
- Added grouped pregame audition coverage for warmup, QB scouting, coin toss, and kickoff clips.

### Changed

- Extended pregame commentary metadata with match phase, priority, team/player/archetype, coin-toss, and kickoff result fields while preserving existing approved pregame assets.
- Updated audio verification to audit the runtime pregame assets alongside the starter pack without folding long pregame clips into the starter-pack memory budget.

### Tests

- Added catalog coverage for every known starting quarterback's trait line, every known team's toss-result variants, kickoff category resolution, deterministic selection, and exact caption/script matching.
- Verified the expanded audio readiness report, full unit suite, and production build.

## [1.9.0] - 2026-06-22

### Added

- Added presentation-only pregame warmup staging with mirrored user/opponent practice zones, quarterback throwing groups, running-back footwork groups, offensive-line stance groups, receiver warmups, football props, and cone props.
- Added a presentation-only starting quarterback spotlight subject and screen-space QB showcase card driven by roster identity, jersey number, scouting archetype, and quarterback ratings.
- Added presentation-only quarterback ratings and scouting profile helpers for throw power, accuracy, mobility, archetype, and strengths.

### Changed

- Updated pregame matchup and full-cinematics team shots to prefer warmup subjects instead of frozen gameplay formations or empty sideline/tunnel pans.
- Updated the quarterback spotlight resolver to use the warmup QB clone as its visual subject while preserving gameplay QB IDs and roster identity as read-only references.
- Expanded pregame debug snapshots with warmup readiness and presentation-clone counts.

### Tests

- Added pregame warmup unit coverage for mirrored layouts, protected-field separation, roster QB identity, ratings fallback, visual resource bounds, and repeated disposal.
- Updated pregame presentation coverage for warmup-based spotlight subjects, full-sequence warmup pans, and no-gameplay-authority clone reporting.
- Increased the broad title/setup smoke-test timeout to cover the longer normal-player flow under concurrent browser-suite load.

## [1.8.0] - 2026-06-22

### Added

- Added a dedicated Match Setup flow between the title screen and pregame presentation with user/opponent team cards, generic SVG helmet badges, uniform selection, starting quarterback readouts, matchup summary, and optional team customization.
- Added a pure match-setup selection model with same-team validation, deterministic visual-uniform conflict detection, and one-click uniform correction.

### Changed

- Updated Start Game so it opens Match Setup first; Confirm Match now validates the matchup, applies the selected team profiles, and enters the existing pregame sequence without starting the match clock or snapping the ball.
- Scoped the player-facing Settings panel to general presentation/game configuration by moving active team and roster controls out of Settings and hiding regression playbook controls from the normal title flow.

### Tests

- Added match-setup unit coverage for default validation, same-team blocking, deterministic uniform conflict correction, and independent team/uniform updates.
- Updated browser smoke coverage for title -> Match Setup -> pregame, Back navigation, hidden team controls in Settings, visible registered teams, helmet badge coloring, starting quarterback display, and legacy playbook query overrides.

## [1.7.5] - 2026-06-22

### Fixed

- Prevented generated pregame announcer clips from being cut short when their decoded MP3 duration is longer than the script catalog estimate.
- Increased the default quiet gap between serialized pregame announcer lines so the intro has clearer separation before the matchup/team call.

### Tests

- Added pregame audio coverage for stale catalog durations, decoded playback-duration safety timing, and the wider default quiet gap before queued lines start.

## [1.7.4] - 2026-06-22

### Changed

- Renamed the prototype broadcaster identity to the fictional announcer `Grant Mercer` across the central brand config, audio-production identity, caption manifests, and audition pages.
- Regenerated the three pregame welcome intro MP3 clips so the spoken opening lines introduce Grant Mercer instead of the placeholder announcer label.

### Tests

- Updated brand and audio pipeline coverage for the named announcer identity.

## [1.7.3] - 2026-06-22

### Fixed

- Serialized pregame announcer playback so a second pregame line waits for the active clip's actual audio completion plus a short quiet gap instead of relying on catalog duration alone.
- Prevented late or failed pregame audio handles from hanging or reactivating a completed line, with safety-timeout fallback and skip cleanup for queued speech.
- Simplified brief and full pregame camera sequencing to use one continuous matchup-wide shot instead of separate user/opponent team camera flips.

### Changed

- Kept team-specific pregame pan shots available only as development shot-preview subjects while normal pregame presentation now favors stable stadium, matchup, weather, quarterback, and gameplay-transition shots.
- Expanded pregame F1 diagnostics with active/queued commentary, playback state, actual end timing, subject readiness, shot transition timing, and camera displacement/angle readouts.

### Tests

- Added pregame audio coordinator coverage for non-overlap, actual-playback completion, duration-metadata non-advancement, failed-clip release, and skip queue cleanup.
- Updated pregame sequence coverage for the continuous `matchupWide` shot and unavailable-team-zone fallback.

## [1.7.2] - 2026-06-22

### Fixed

- Removed normal-game first-down, touchdown, and out-of-bounds crowd cutaway camera shots while keeping crowd reactions, audio, commentary, captions, and touchdown scorer focus intact.
- Reset debug tools and officials debug labels to off when migrating older persisted settings so a plain launch stays free of debug overlays.
- Closing the F1 debug panel now disables and disposes enabled debug helpers instead of leaving overlays active behind the panel.

### Changed

- Kept crowd cutaway shot implementations available only through explicit development shot previews.
- Removed the officials debug-label control from the player-facing Settings screen; official diagnostics now live in the F1 debug panel.
- Bumped the persisted game-settings schema to `9`.

### Tests

- Added coverage for no normal crowd cutaways on first down, touchdown, and out-of-bounds results, plus development shot-preview availability.
- Added migration coverage for clearing legacy debug flags while preserving normal audio, camera, crowd, stadium, and official settings.
- Extended browser smoke coverage for plain-launch debug-free presentation, enabled normal officials, F1 official diagnostics, and F1 helper disposal.

## [1.7.1] - 2026-06-22

### Fixed

- Reset pregame presentation identity when returning to the title screen so a new match can replay the opening quarterback spotlight while same-match duplicate suppression remains intact.
- Cleared active pregame captions during title return to avoid stale presentation text carrying into the next launch.

### Changed

- Expanded the Pregame F1/debug readback with active team, active subject, title-music state, crowd loop/ducking state, sideline/tunnel counts, presentation clone count, and frame metrics.
- Added pregame presentation snapshot fields for coordinated opening-flow diagnostics without giving presentation systems gameplay authority.
- Aligned the production reference benchmark stadium draw-call budget with the runtime performance profile and added a guard against future budget drift.

### Tests

- Added unit coverage for pregame identity reset after returning to title.
- Extended browser smoke readback coverage for title-to-pregame diagnostics, and reran full unit, build, smoke, and reference benchmark validation.

## [1.7.0] - 2026-06-22

### Added

- Added a user-team starting quarterback spotlight shot to brief and full Exhibition pregame sequences before playable pre-snap.
- Added lineup-based QB spotlight subject resolution from active team profile, roster, active lineup binding, gameplay player ID, jersey number, appearance ID, and team colors.
- Added QB-specific pregame lower-third presentation, spotlight debug readback, and deterministic pregame quarterback commentary selection from the existing generated catalog.

### Changed

- Kept the spotlight presentation anchored to the existing formation quarterback so no gameplay player is moved, cloned into gameplay, or given presentation authority.
- Prevented the quarterback spotlight from replaying later in the same match while keeping rematch selection deterministic.

### Tests

- Added pregame sequence, QB subject resolution, lower-third identity, missing-roster fallback, and same-match no-replay coverage.

## [1.6.0] - 2026-06-22

### Added

- Added a runtime pregame broadcast presentation phase between `Start Game` and playable pre-snap for normal Exhibition starts.
- Added data-defined brief/full pregame shot sequences for stadium establish, matchup, team sideline/tunnel pans, weather/field, and transition-to-gameplay shots using the existing camera rig.
- Added pregame audio coordination for title-music duck/fade, crowd ambience, pre-rendered pregame announcer clips, captions, skip handling, lower thirds, and F1/debug readback.

### Changed

- Kept gameplay simulation, AI, match clock, snap input, HUD, and play cards paused while the pregame sequence is running.
- Scoped pregame presentation to Exhibition mode so legacy score-attack regression starts remain immediate.
- Extended the local runtime audio manifest to include pregame announcer assets under `public/audio/announcer/pregame`.

### Tests

- Added pregame presentation unit coverage and browser smoke coverage for title-to-pregame-to-preSnap, skip behavior, score-clock pause, debug registry integration, and legacy 5v5 score-attack behavior.

## [1.5.0] - 2026-06-22

### Added

- Added presentation-only sideline team and tunnel tableau staging with mathematical user/opponent zones, low/medium/high density settings, and optional tunnel starter subjects.
- Added an instanced low-poly sideline visual factory using shared primitive geometry, team uniform colors, deterministic skin tones, bounded draw calls, and resource/disposal metrics.
- Added F1/debug support for sideline counts, zones, draw calls, triangles, instance bytes, and update cadence.

### Changed

- Extended broadcast/performance/custom experience settings and the pause settings panel with sideline players, sideline density, and tunnel tableau controls.
- Included sideline teams in renderer, memory, diagnostics, and reset-cycle resource snapshots without adding gameplay actors, collision, assignments, AI, or roster entries.

### Tests

- Added sideline presentation tests for density counts, protected-field exclusion, zone symmetry, stadium tunnel alignment, instanced resource budgets, deterministic appearance variation, lifecycle disposal, and gameplay-roster isolation.

## [1.4.0] - 2026-06-22

### Added

- Added a pure pregame commentary catalog for welcome, ordered team matchup, weather, and starting-quarterback spotlight lines generated from `GameBrand`, `TeamRegistry`, and roster identity data.
- Added Node-only pregame ElevenLabs speech generation tooling with dry-run default, required `--execute --max-files` for paid runs, existing-file protection, metadata-rich provenance sidecars, captions, and a grouped pregame audition page.
- Generated 49 pregame announcer MP3 clips under `public/audio/announcer/pregame` using the existing prototype announcer voice.

### Changed

- Added a Node-only ElevenLabs SDK import fallback for audio tooling when the package root entry is missing emitted runtime files, without adding any browser SDK usage.
- Documented the pregame voice pack as generated local content while keeping runtime pregame sequencing as future scope.

### Tests

- Added pregame commentary coverage for deterministic selection, rematch repetition avoidance, team/QB/weather fallbacks, exact captions, dry-run safety, missing-key behavior, existing-file protection, provenance metadata, and browser-secret scanning.

## [1.3.0] - 2026-06-21

### Added

- Added the official two-button Football JS title screen with selected title artwork, emblem fallback handling, crisp HTML title text, and a hidden reusable settings overlay.
- Added runtime title-music playback through a dedicated streamed music bus, first-gesture audio unlock, fade-in, looping, and pregame handoff state.
- Added a persisted music-volume setting and tests for streamed title music, handoff behavior, settings migration, and the player-facing title flow.

### Changed

- Updated the runtime audio manifest to include the selected `football-js-title` MP3 as a streamed local asset instead of a decoded buffer.
- Updated the title/start lifecycle so Settings opens from the title screen, Escape closes Settings, Enter starts the game, and debug tools remain behind F1.

## [1.2.0] - 2026-06-21

### Added

- Installed the official ElevenLabs `music` skill and added Node-only title-music production tooling for `music_v2` plan validation, dry-run guarded generation, reporting, audition HTML, selection, and provenance.
- Generated three original instrumental Football JS title-theme candidates under `public/audio/music` and selected candidate A as the provisional stable `football-js-title.mp3`.
- Added music pipeline tests for dry-run behavior, missing-key failure, existing-file protection, provenance/song-ID capture, report/audition output, stable selection copying, and secret scanning.

### Changed

- Extended shared audio schemas to support `music` assets, `mp3_48000_192`, longer music durations, local ElevenLabs key-file parsing, and optional song IDs in provenance sidecars.
- Updated `GameBrand.titleMusicId` to point at the selected title-music asset while leaving runtime playback unimplemented.

## [1.1.0] - 2026-06-21

### Added

- Added the central `Football JS` brand configuration with selected title-background and emblem image URLs plus the preserved fictional announcer display name.
- Added Node-only OpenAI GPT Image 2 brand production tooling for typed asset planning, dry-run guarded generation, provenance sidecars, report output, gallery HTML, and stable runtime image selection.
- Generated two title-background candidates and two emblem candidates, then selected provisional runtime assets at `public/branding/football-js-title.webp` and `public/branding/football-js-emblem.webp`.

### Changed

- Updated the title screen and document title to resolve the player-facing title from the brand configuration.
- Documented OpenAI image generation as offline-only production tooling and added safe local `OPENAI_API_KEY` guidance without exposing secrets to browser code.

### Tests

- Added brand asset pipeline coverage for plan validation, missing-key failure, dry-run behavior, existing-file protection, invalid output-path rejection, report/gallery/selection output, and browser-secret scanning.

## [1.0.0] - 2026-06-21

### Added

- Added the offense-only Exhibition game shell with teams, four configurable quarters, deterministic opening and second-half possession, match clock, score, drive number, current field position, previous drive summary, halftime, final score, rematch, and return-to-title flow.
- Added a deterministic opponent-drive simulator that resolves opponent possessions into broadcast-style summaries for punts, field goals, touchdowns, turnovers, turnover on downs, end of half, and end of game without running real-time defensive gameplay.
- Added user-drive match handling for touchdowns with separate automatic extra-point events, turnover on downs, abstract pre-snap punts, quarter-expiration handling, and score/clock updates.
- Added Exhibition UI surfaces: compact match scorebug, pre-snap Punt button, opponent-drive summary panel, quarter/halftime transition panel, and game-over summary panel.

### Changed

- Made `Exhibition - Offense Only` the normal title-screen game mode and preserved the previous two-minute score attack as `Development Score Attack`.
- Extended the persisted settings schema to version 6 with game mode, match difficulty, and quarter length settings.
- Kept direct 5v5 and 7v7 regression playbook links in score-attack mode unless Exhibition is explicitly requested.
- Hid the legacy score-attack score/clock chrome during Exhibition so the match scorebug is authoritative.
- Updated README and AGENTS to describe the offense-only Exhibition shell, simulated opponent possessions, and Score Attack as a regression harness.

### Tests

- Added deterministic match-model and match-flow coverage for pregame startup, possession selection, quarter progression, opponent-drive determinism, opponent scoring, user touchdowns, turnover on downs, punt flow, live-play clock expiration, rematch reset, and score-attack regression mode.
- Updated browser smoke coverage for title/start match flow, Exhibition settings readback, regression playbook setup, schema migration, and match debug readback.

## [0.53.0] - 2026-06-21

### Added

- Added fictional roster identities for every starter and specialist on the four starter teams, with stable roster IDs, jersey numbers, football positions, archetypes, appearance IDs, and position-number convention warnings.
- Added active lineup binding from stable gameplay player IDs to roster player IDs for the maintained 5v5, 7v7, and default 11v11 playbooks without replacing gameplay IDs.
- Added a title/setup roster preview listing the active lineup's number, name, and football position for the selected game mode and teams.
- Added a pooled retro world-space controlled-player label that displays the current carrier's roster name and jersey number, transfers after catches, caches label textures by roster player, and stays presentation-only.

### Changed

- Extended settings schema version 5 with controlled-player and selected-receiver label toggles, defaulting the controlled-player label on and the selected-receiver label off.
- Updated HUD pass-target text to resolve roster names and jersey numbers when a roster binding is available while preserving gameplay receiver IDs and display labels.
- Added F1/debug readback for roster-label presentation state, including gameplay ID, roster ID, display name, number, visibility reason, label position, and texture-cache size.

### Tests

- Added roster identity and controlled-player label unit coverage for unique jersey numbers, lineup binding, stable identities across resets/play changes, catch transfer, texture caching, disabled-label behavior, and readable team colors.
- Updated browser smoke coverage for the default controlled-player label, roster target labels, settings migration, and the expanded experience settings snapshot.

## [0.52.0] - 2026-06-21

### Added

- Added fictional team profiles, home/away uniform palettes, persisted team customization settings, six-digit hex color validation, reset-to-defaults, and deterministic similar-uniform warnings.
- Added a title/setup team customization panel with team selectors, uniform selectors, preset swatches, and HTML color pickers for primary, secondary, helmet, pants, and faceguard colors.
- Routed one resolved team theme through player jerseys, shoulder pads, pants, helmet shells, faceguards, HUD/scorebug colors, pre-snap play-card markers, field end zones, and supported crowd accent colors.

### Changed

- Kept team and uniform changes title/setup-only during active matches while pause settings continue to apply safe presentation/audio changes.
- Preserved role-specific body colors behind `?debugRoleColors=1` and kept deterministic skin tones independent from team identity.

### Tests

- Added team-profile validation, settings persistence/migration, palette resolution, color contrast, field end-zone theming, custom player-uniform, helmet-color, and bounded shared-material coverage.

## [0.51.6] - 2026-06-21

### Fixed

- Coordinated touchdown reset through a single presentation hold contract that waits for visual minimum time, touchdown camera completion, crowd minimum time, and announcer commentary completion or failure.
- Exposed presentation-safe commentary playback state, including active clip, event ID, expected/elapsed/remaining duration, completed event IDs, and failed event IDs.
- Prevented touchdown reset from interrupting active announcer lines and captions; reset now occurs after the line finishes plus a short configured tail, unless audio is disabled, failed, or unavailable.
- Kept cinematics-off touchdown results briefly framed long enough for enabled commentary to finish instead of resetting immediately after the gameplay delay.
- Added touchdown-hold debug status for result ID, elapsed time, minimum hold, current shot, camera completion, commentary clip/remaining time, crowd minimum, block reason, and release reason.

### Tests

- Added deterministic hold coverage for short and long touchdown commentary, failed commentary fallback, announcer-disabled mode, cinematics-off commentary completion, camera-only completion, commentary-only completion, safety maximum release, and camera-skip behavior.
- Added commentary playback-state tests for completion and failed playback reporting.
- Updated presentation runtime and browser smoke coverage for the commentary-aware hold contract.

## [0.51.5] - 2026-06-21

### Fixed

- Added an explicit camera-shot policy so tactical, offense, and cinematic camera modes each allow only the cinematic shots that match their presentation role.
- Prevented tactical orthographic mode from activating presentation-camera overrides, perspective camera swaps, automatic pre-play orbits, and crowd cutaways.
- Limited offense perspective mode to normal behind-offense gameplay framing plus optional post-score presentation, with no automatic pre-play formation orbit.
- Restored full pre-play orbit eligibility only for cinematic broadcast mode with full cinematics enabled, while keeping explicit shot-preview debugging available.
- Reset incompatible presentation-shot state when camera modes change so switching into tactical immediately returns to the orthographic overview.
- Clarified gameplay-camera descriptions in the settings panel.

### Tests

- Added camera-policy coverage for tactical, offense, and cinematic camera modes across cinematics settings.
- Added regression coverage proving tactical remains orthographic under touchdown presentation conditions, cinematic full can still run the pre-play orbit, and switching into tactical cancels an active override.

## [0.51.4] - 2026-06-21

### Fixed

- Reduced the normal presentation-official crew to the referee and umpire.
- Added a shared image-textured jersey panel mesh to the procedural player body without changing gameplay collision or replacing the primitive mannequin.
- Prevented play-card clicks from leaving focus on card buttons so Space can reliably snap the ball after selecting a play with the pointer.
- Disabled the normal pre-snap orbit camera during play selection while keeping explicit shot previews and touchdown/cutaway shots available.
- Smoothed the debug overlay `FRAME_MS` display so startup and first-play presentation work does not make the visible metric jump as harshly.
- Allowed runtime formations to compress longitudinally within the full field surface so out-of-bounds resets inside the 10-yard line no longer crash on deep defenders resolving beyond the back of the end zone.

### Tests

- Added unit coverage for red-zone out-of-bounds reset recovery and jersey-panel sharing.
- Updated camera, official, player-visual, and browser smoke coverage for the two-ref crew, no normal pre-play orbit, click-then-Space play-card flow, and the new mannequin mesh counts.

## [0.51.3] - 2026-06-21

### Fixed

- Froze presentation/camera delta while the pause settings panel is visible so scrolling settings no longer advances pre-snap cinematics or jitters the background camera.
- Stopped wheel and touch-scroll events from propagating out of the pause settings modal.

### Tests

- Added browser smoke coverage that opens pause settings, scrolls the settings card, and verifies the gameplay camera position and target remain stable.

## [0.51.2] - 2026-06-21

### Fixed

- Stabilized pre-snap camera behavior so changing plays no longer restarts completed pre-play orbit shots, clears camera smoothing history, or recenters presentation shots on formation bounds.
- Anchored pre-snap presentation shots to the authoritative snap-ball position while still using formation size to smooth framing distance.
- Added camera-stability debug data for pre-snap sequence ID, selected play, desired camera/look targets, per-frame displacement, angular change, and target-change reason.

### Tests

- Added camera coverage for rapid 7v7 play switching across left hash, middle, right hash, tactical, offense, and cinematic camera modes.
- Verified immediate snap after play selection still starts gameplay and that full unit, build, and browser smoke suites pass.

## [0.51.1] - 2026-06-21

### Changed

- Hardened normal-game integration across the title flow, broadcast settings, stadium, crowd, officials, audio unlock, debug tools, camera focus, and reset-cycle resource diagnostics.
- Added runtime field-audit control to the F1 debug panel and grouped presentation officials as their own memory-profiler subsystem.
- Cleared stale cinematic camera shot debug state when presentation shots are skipped or reset.

### Tests

- Extended browser smoke coverage for plain-launch broadcast startup, responsive title layout, Escape settings, F1 debug-tool lifecycle disposal, and 100-cycle 11v11 reset stability with stadium, crowd, and officials enabled.
- Extended unit coverage for official memory ownership and cinematic-mode shot skip regression.

## [0.51.0] - 2026-06-21

### Added

- Added a presentation-only seven-official crew with stable official IDs, ball/line/sideline-derived positioning, bounded live tracking, dead-ball settling, touchdown signal poses, and exact pre-snap reset restoration.
- Added low-poly procedural official visuals using shared instanced geometry/materials, deterministic skin tones, striped torsos, black pants/shoes/caps, and clean presentation-owned disposal.
- Added an Officials debug feature in the F1 panel plus debug readback snapshots for official role, current position, target position, distance from the ball, update state, and visual resource metrics.

### Changed

- Broadcast settings now enable presentation officials by default, while Performance disables them as an optional visual cost.
- Extended settings persistence/migration, setup controls, README, and AGENTS guidance for presentation-only officials and no officiating authority.

### Tests

- Added focused officials coverage for stable IDs, snap-lane positioning, direction mirroring, sideline placement, pre-snap stability, live tracking, touchdown signals, reset restoration, visual disposal, gameplay-roster separation, and camera ball-focus preservation.
- Updated browser smoke readbacks for the officials settings/defaults and normal-game crew visibility.

## [0.50.0] - 2026-06-21

### Added

- Added the first normal-game mathematical stadium bowl with centralized stadium spec values, rounded-rectangle path sampling, tiered row layout, seat transforms, prototype SVG image materials, simple fallback materials, scoreboard, tunnels, fascia, concourse wall, and exterior wall.
- Added stadium controller integration through the normal presentation runtime and game experience settings, with broadcast enabling the stadium and performance simplifying it by disabling upper-tier/image-material presentation.
- Added stadium seat-layout-derived crowd placement so normal crowd instances and crowd preview use real stadium seat transforms rather than a separate crowd placement formula.

### Changed

- Split crowd resources so the crowd owner contains only instanced spectators while stadium seating and bowl geometry are owned by the new stadium system.
- Extended runtime settings, smoke debug readback, memory subsystem classification, README, and AGENTS guidance for normal-game stadium presentation.

### Tests

- Added stadium path, row, seat layout, tunnel exclusion, crowd-seat derivation, geometry containment, resource disposal, and controller snapshot coverage.
- Updated crowd, settings, memory, and browser smoke coverage for the stadium/crowd ownership split.

## [0.49.0] - 2026-06-21

### Added

- Added a runtime memory profiler that reports renderer counters, calculated geometry/index/instance buffer bytes, texture estimates with unknown formats labelled, browser memory support status, and subsystem ownership for field, players, helmets, football, route art, crowd, stadium, and other resources.
- Added a lazy `Memory` debug panel with crowd-capacity controls for running, canceling, applying, and exporting a session-local benchmark report.
- Added an adaptive crowd-capacity benchmark that temporarily suppresses the normal presentation crowd, measures a no-crowd baseline, tests deterministic spectator counts, disposes temporary crowd resources between trials, and recommends a crowd density for the current browser session only.

### Changed

- Extended the debug registry metadata for richer runtime debug-feature descriptions while preserving lazy creation and disposal.
- Preserved the existing quality debug overlay as a separate `Quality` feature and `?qualityDebug=1` path while adding `?memoryDebug=1` for memory diagnostics.

### Tests

- Added unit coverage for geometry/index/instance byte calculations, texture estimates, unsupported browser memory APIs, scene resource grouping, crowd benchmark cancellation, repeated benchmark resource cleanup, and crowd-density recommendation mapping.
- Added browser smoke coverage for opening the runtime memory panel from the `F1` debug panel without mutating gameplay state.

## [0.48.0] - 2026-06-21

### Added

- Added a versioned `GameSettings` facade, migration helper, and localStorage store for player-facing settings, including playbook, presentation, crowd, audio volume, route-art, player-motion, officials, and debug-tool preferences.
- Added a registry-driven runtime debug panel toggled with `F1`, with lazily created/disposed debug features for metrics, camera, formation, route, passing, appearance, audio, commentary, crowd, presentation, memory, and audit overlays.
- Added settings UI support for debug tools, route art, procedural motion, officials, mute, and master/crowd/announcer volumes.

### Changed

- Replaced the setup widget with the new `SettingsPanel`, while preserving the title and pause flows and keeping `GameSetupScreen` as a compatibility export.
- Updated game-mode choices to come from playbook registry metadata instead of a second hard-coded UI list.
- Runtime settings now apply safe presentation changes immediately, including camera, captions, route art, player motion, crowd settings, audio gains, mute, and debug visibility.

### Tests

- Added unit coverage for settings migration/persistence and debug-feature lazy lifecycle.
- Added browser smoke coverage for `F1` debug-panel toggling and title-screen debug-setting persistence.

## [0.47.1] - 2026-06-21

### Changed

- Centered normal gameplay camera focus on the authoritative football position for pre-snap, live possession, pass-flight, dead-ball, and reset phases while preserving cinematic overrides and camera smoothing.
- Removed the yellow play-direction arrow from the field while keeping the line of scrimmage, first-down line, route art, yard lines, bounds, and field-audit behavior intact.

### Tests

- Added projection-based camera coverage that validates the ball remains near normalized-device-coordinate center during live gameplay and pass flight.
- Added field coverage proving the normal field contains no play-direction arrow or direction-marker mesh.

## [0.47.0] - 2026-06-21

### Added

- Added an Adaptive 60 FPS runtime quality governor with rolling frame-time monitoring, hysteresis, cooldowns, safe-boundary scheduling, and explicit Broadcast/Performance locked modes.
- Added quality profiles for Broadcast High, Balanced, and Performance with render pixel-ratio caps and crowd-presentation reductions that do not alter gameplay state, roster size, collision, routes, ball trajectory, input, or camera focus targets.
- Added quality mode persistence, title/pause settings controls, `?quality=` overrides, and `?qualityDebug=1` readout for quality mode, tier, pixel ratio, rolling median/p95, FPS, transition reasons, and pending safe-boundary transitions.
- Added unit coverage for runtime performance monitoring, adaptive downgrade/upgrade policy, safe-boundary scheduling, locked quality modes, and quality-setting resolution.

### Changed

- Extended production performance gates with measured structural budgets for draw calls, triangles, geometries, materials, textures, visible player meshes, shadow casters, crowd draw calls, and stadium draw-call estimates.
- Updated `npm run test:perf`/`perf:11v11` fixed-profile benchmark queries so adaptive quality is disabled during profiler runs.
- Updated the reference benchmark so strict median/p95/p99 timing enforcement is gated by `PERF_STRICT=1`, while hardware smoke runs still reject sustained sub-55 FPS and software rendering remains timing-informational.

## [0.46.1] - 2026-06-21

### Added

- Added a frozen 11v11 optimization ownership manifest documenting the measured bottlenecks, classifications, branch ownership, and merge rules.

### Changed

- Cached receiver route runtime data for selected/reset/snapped plays so receiver updates and pass targeting reuse resolved routes instead of resolving route definitions every frame.
- Cached player visual hierarchy and helmet references so normal per-frame sync avoids repeated `getObjectByName`, body traversal, helmet part traversal, and unchanged material reassignment.

### Performance

- Short production perf smoke reduced `eleven-pass-flight` `receiverRouteUpdates` from baseline avg `0.09 ms` / p95 `0.20 ms` to avg `0.006 ms` / p95 `0.05 ms` after the gameplay branch merge.
- Short production perf smoke reduced `eleven-pass-flight` `playerVisualSync` from baseline avg `0.32 ms` / p95 `0.40 ms` to avg `0.023 ms` / p95 `0.10 ms` after both optimization branches were integrated.

## [0.46.0] - 2026-06-21

### Added

- Added a disabled-by-default 11v11 frame profiler with preallocated ring-buffer sampling, exclusive nested phase timing, long-frame records, and renderer/scene-structure metrics.
- Added deterministic 11v11 performance scenarios for presnap, run, pass, after-catch, touchdown-presentation, and reset-cycle profiling.
- Added `npm run perf:11v11`, `npm run perf:report`, and `npm run test:perf` for production-build 11v11 profiling and report review.
- Added production Playwright coverage in `tests/performance/elevenOnEleven.performance.spec.ts` plus focused unit coverage for profiler buffers, reports, and scenario setup.

### Changed

- Extended the readback debug API with performance-only scenario and report methods when `?perfProfile=1` is enabled.

## [0.45.3] - 2026-06-21

### Added

- Added a production-only reference performance benchmark through `npm run benchmark:reference`, backed by `playwright.performance.config.ts` and `tools/performance/referenceBenchmark.spec.ts`.
- Added pure benchmark helpers for frame-time percentiles, rolling one-second FPS windows, timing gate evaluation, and software-renderer detection, with unit coverage in `tests/referenceBenchmark.test.ts`.
- Added benchmark reporting to `test-results/reference-performance-report.json` for the 11v11 broadcast scenario with low-density crowd visuals, procedural player motion, brief cinematics, and debug overlays disabled.

### Changed

- Extended `?readback=1` so production preview benchmark runs can expose the read-only debug API without showing development overlays.

## [0.45.2] - 2026-06-21

### Changed

- Refactored field rendering into focused `src/field/*` modules for layout, material ownership, geometry construction, dynamic drive markers, and resource disposal while preserving the public `src/field.ts` API and existing field presentation.
- Refactored camera runtime code into focused `src/camera/*` modules for shared types, configuration, focus resolution, rig mutation, shot definitions, and shot sequencing while preserving all camera modes and cinematic shots.
- Refactored crowd preview and normal-game crowd presentation into focused `src/crowd/*` modules for deterministic layout, mesh construction, metrics, reaction state, and resource ownership while preserving InstancedMesh batching and behavior.
- Refactored application startup from `src/main.ts` into lifecycle owners under `src/app/*`, including scene, game loop, gameplay orchestration, player visuals, presentation coordination, and development diagnostics.

### Fixed

- Added explicit typing around announcer voice-design preview data so the restored TypeScript build remains clean with the current ElevenLabs SDK types.

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
