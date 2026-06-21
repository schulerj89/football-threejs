# 11v11 Performance Optimization Ownership

Baseline commit: `973f4e012b02c2795ce4c1fe793f6b1ae623f845`

Fresh report: `test-results/eleven-performance-report.json`, generated locally on 2026-06-21.

## Top Measured Bottlenecks

Slowest full-broadcast scenario: `eleven-pass-flight`.

| Rank | Phase | Metric | Classification | Responsible Files |
| --- | --- | --- | --- | --- |
| 1 | `rendererRender` | avg `1.09 ms`, p95 `1.30 ms`, `350` calls, `180008` triangles | render submission / GPU-fill informational | `src/playerVisual.ts`, `src/app/PlayerVisualRegistry.ts`, `src/helmetVisual.ts`, `src/field/*`, `src/presentation/RouteArtRenderer.ts`, `src/crowd/*` |
| 2 | `playerVisualSync` | avg `0.32 ms`, p95 `0.40 ms` | presentation CPU | `src/app/PlayerVisualRegistry.ts`, `src/playerVisual.ts`, `src/helmetVisual.ts` |
| 3 | `receiverRouteUpdates` | avg `0.09 ms`, p95 `0.20 ms` | gameplay CPU | `src/teamSimulation.ts`, `src/receiverRoutes.ts`, `src/playState.ts`, `src/playbook.ts` |
| 4 | `hudDomUpdate` | avg `0.08 ms`, p95 `0.20 ms` | presentation CPU | `src/gameplayHud.ts`, `src/playCallUi.ts`, `src/ui/BroadcastCaptions.ts` |
| 5 | `crowdInstanceUpdates` | avg `0.05 ms`, p95 `0.30 ms` | presentation CPU / environment | `src/presentation/CrowdPresentationController.ts`, `src/crowd/CrowdMeshFactory.ts`, `src/crowd/CrowdReactionModel.ts` |

The reference profile already meets the timing contract on this machine: no frames over `16.67 ms`, p95 below `18.18 ms`, p99 below `33.33 ms`, and minimum rolling FPS `60`.

## Worktree Ownership

Only measured, meaningful targets receive worktrees.

### Worker A: Gameplay CPU

Branch: `perf/eleven-gameplay`

Allowed write set:

- `src/teamSimulation.ts`
- `src/receiverRoutes.ts`
- `src/playState.ts`
- `src/playbook.ts`
- focused tests for route/team simulation only

Target metric:

- `receiverRouteUpdates` in `eleven-pass-flight` and `eleven-pass-routes`.

Primary evidence:

- Repeated `resolveReceiverRoute`, `getRouteDefinition`, `sampleRouteAtDistance`, and tangent sampling during receiver updates.

### Worker B: Player Presentation

Branch: `perf/eleven-player-presentation`

Allowed write set:

- `src/app/PlayerVisualRegistry.ts`
- `src/playerVisual.ts`
- `src/helmetVisual.ts`
- focused tests for player visuals only

Target metrics:

- `playerVisualSync` across all 11v11 scenarios.
- Renderer submission only when reduced by measured visual sync or hierarchy caching, not by removing players or motion.

Primary evidence:

- Per-player sync calls `getObjectByName`, traversals, and helmet material sync every frame.

## Not Assigned

- `hudDomUpdate` is currently below `0.1 ms` average and is not meaningful enough for a worktree.
- `crowdInstanceUpdates` is currently below `0.1 ms` average and only spikes to `0.30 ms`; no environment worktree is assigned unless a later report shows it becoming meaningful.
- Renderer initialization, budgets, Playwright configs, package metadata, changelog, README, and this manifest remain lead-only.

## Merge Rules

Merge one branch at a time. After each merge, rerun at least the shortened perf smoke. Before final release, rerun the full `npm run perf:11v11`, `npm run benchmark:reference`, and `npm test`.
