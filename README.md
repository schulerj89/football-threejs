# Football JS

Low-poly 3D American football prototype built with Three.js, Vite, and TypeScript.

Football JS is currently focused on a stylized 11v11 offense-first exhibition game with fictional teams, pregame presentation, coin toss, simulated kickoffs, user offensive drives, opponent drive simulation, halftime, and postgame stats. Dynasty mode is in early staged development.

## Quick Start

```bash
npm install
npm run dev
```

Open the dev server at `http://127.0.0.1:5173`.

## Core Scripts

```bash
npm run build
npm run test:unit
npm run test:smoke
npm test
```

Useful specialized scripts:

```bash
npm run audio:report
npm run audio:verify
npm run branding:report
npm run perf:11v11
npm run benchmark:reference
```

## Current Game

- Play Now: team selection, game settings, pregame presentation, coin toss, kickoff flow, user offensive possessions, simulated opponent possessions, halftime, and end-of-game stats.
- Dynasty: early shell with team-selection wizard, week hub, standings, awards, program info, training, schedule, roster, and exit flow.
- Presentation: broadcast scorebug, route art, defensive debug art, stadium, weather, crowd, sideline, officials, audio, music, lower thirds, and camera shots.
- Gameplay: 11v11 formations, rushing and passing plays, receiver targeting, route-aware passing, tackles, sacks, touchdowns, field goals, punts, safeties, downs, ball spotting, and clock flow.
- Development modes: 11v11 formation previews, player pose harnesses, audits, debug overlays, and performance tooling.

## Controls

- Move: `WASD` or arrow keys.
- Snap/play: `Space`.
- Throw: `F`.
- Cycle receiver: `Tab`.
- Play selection: number keys during pre-snap.
- Debug panel: `F1`.
- Mute toggle after audio unlock: `M`.

## Common URL Flags

- `?camera=tactical`, `?camera=offense`, or `?camera=cinematic`.
- `?cinematics=off`, `?cinematics=brief`, or `?cinematics=full`.
- `?weather=clear`, `?weather=overcast`, or `?weather=rain`.
- `?routeArt=0` to hide offensive route art.
- `?coverageArt=1` or `?defenseArt=1` for defensive debug art.
- `?debug=1`, `?audioDebug=1`, `?cameraDebug=1`, `?routeAudit=1`, or `?passAudit=1` for focused diagnostics.

## Project Map

- `src/app`: application lifecycle, scene, loop, runtime orchestration, and diagnostics.
- `src/match`: match rules, clock, possession, coin toss, scoring, and phase flow.
- `src/playState`: live gameplay model and player simulation.
- `src/playbook`: offensive plays, formations, routes, and play-call data.
- `src/presentation`: pregame, halftime, postgame, camera, stage, sideline, and broadcast presentation.
- `src/audio`: local audio manifests, commentary catalogs, music, voice packs, and runtime audio coordination.
- `src/teams`, `src/roster`, `src/league`: team identity, uniforms, roster identity, ratings, and dynasty data.
- `src/field`, `src/stadium`, `src/crowd`, `src/weather`: field, stadium, crowd, and weather presentation.
- `tools`: asset generation, reports, benchmarks, and artifact capture.
- `tests`: unit, smoke, visual, performance, and regression coverage.
- `docs`: deeper notes for performance, optimization ownership, and specialized systems.

## Assets And Generation

Generated media is stored under `public/`. Browser runtime code uses local assets only.

- Audio generation scripts default to dry-run. Paid ElevenLabs calls require direct execution with `--execute`.
- Branding and image-generation scripts default to dry-run. Paid image generation also requires `--execute`.
- Do not expose `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`, or any secret through browser code or `VITE_` environment variables.

## Performance

Use `npm run benchmark:reference` for the main reference benchmark and `npm run perf:11v11` for deterministic 11v11 profiling. Reports are written under `test-results/`.

For performance policy and budgets, see `docs/PERFORMANCE_GOVERNOR.md` and `docs/PERFORMANCE_OPTIMIZATION_OWNERSHIP.md`.

## Notes

- World scale is `1 Three.js unit = 1 yard`.
- The field is `120 x 53.33` units, including two 10-yard end zones.
- The official title is centralized in `src/config/GameBrand.ts`.
- Release history lives in `CHANGELOG.md`.
