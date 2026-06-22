# Adaptive Performance Governor

The normal player-facing default is `Adaptive 60 FPS`. It is a presentation-only fallback for maintaining smooth 11v11 rendering across crowd, stadium, cinematic, and device conditions.

## Reference Profile

The fixed reference profile is measured in production Chromium through `vite preview`, not Vite development mode:

- Viewport: `1920 x 1080`, device scale factor `1`.
- Gameplay: 11v11 active, default Inside Zone 11 / Spread Quick 11 playbook.
- Presentation: offense camera, brief cinematics, full measured crowd fullness, stadium enabled, procedural player motion enabled, debug helpers disabled.
- Sampling: 3-second warm-up, at least 12 seconds per scenario, hidden-tab frames ignored.
- Profiler runs use `quality=locked-broadcast` so adaptive quality cannot hide fixed-profile cost.

## Targets And Gates

Primary local hardware target:

- Median frame time `<= 16.67 ms`.
- p95 frame time `<= 18.18 ms`.
- p99 frame time `<= 33.33 ms`.
- No rolling one-second window below `55 FPS`.

Smoke tolerance:

- `55-60 FPS` is accepted.
- Hardware-rendered runs fail when performance remains below `55 FPS` for more than one rolling one-second window.
- Software renderers such as SwiftShader report timing but do not hard-fail timing gates.
- Structural budgets always apply.

Run strict local timing gates with:

```bash
PERF_STRICT=1 npm run test:perf
```

## Structural Budgets

Budgets are based on the measured optimized reference build plus a small margin:

- Draw calls: `450`.
- Triangles: `250000`.
- Geometries: `180`.
- Materials: `90`.
- Textures: `32`.
- Visible player meshes: `390`.
- Shadow casters: `0`.
- Crowd draw calls: `8`.
- Stadium draw-call estimate: `4`.
- Active gameplay players: `22`.
- Crowd visible seats: `5000`, with a bounded `500`-spectator reacting near tier and static far-bowl mosaic.

Do not raise these budgets without rerunning the fixed reference profile and recording the measured reason.

## Quality Modes

- `adaptive60`: starts at Broadcast High and changes tiers only after sustained rolling-frame evidence.
- `lockedBroadcast`: keeps Broadcast High fixed for comparisons and profiling.
- `lockedPerformance`: keeps Performance fixed for low-cost presentation.

Query overrides:

- `?quality=adaptive`
- `?quality=locked-broadcast`
- `?quality=locked-performance`

## Adaptive Tiers

- Broadcast High: pixel ratio cap `2`, measured full crowd fullness, crowd reactions enabled.
- Balanced: pixel ratio cap `1.5`, same measured full crowd fullness, crowd reactions enabled.
- Performance: pixel ratio cap `1`, visual crowd disabled, crowd reactions disabled.

Adaptive quality can reduce only render pixel ratio and crowd presentation. It must never change gameplay player count, roster, simulation results, collision precision, ball trajectory, route progression, blocking assignments, score, drive state, controlled-player input, or camera focus target.

Crowd resource changes are applied only during title/setup, pre-snap, dead-ball, or game-over boundaries. Live runs, pass flights, catches, and scrambles cannot rebuild crowd resources.

## Debugging

Use `?qualityDebug=1` to display:

- Quality mode and current tier.
- Renderer pixel ratio.
- Rolling median and p95 frame time.
- Current FPS.
- Recent downgrade and upgrade reasons.
- Pending safe-boundary transition.
- Latest profiler limiting subsystem when `?perfProfile=1` is active.
