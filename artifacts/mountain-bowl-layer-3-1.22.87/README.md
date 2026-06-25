# Mountain Bowl Layer 3 - 1.22.87

## Scope

- Added a low-cost valley skirt around the outer bowl to suppress exposed blue void strips.
- Added three uneven base berms in front of the mountain ridges to break up the straight dark base band.
- Split the debug snapshot into whole mountain-bowl bounds and scenic backdrop bounds so the valley skirt can wrap the bowl while scenic ridges remain guarded behind the far bowl.

## Proof

- `mountain-bowl-layer-3-wide.png`
- `mountain-bowl-layer-3-ultrawide.png`
- `mountain-bowl-layer-3-debug-snapshot.json`

## Debug Snapshot Highlights

- `themeId`: `mountainBowl`
- Base berms: `3`
- Valley skirt segments: `4`
- Scenic min Z: `155.5`
- Mountain-only triangles: `237`
- Total stadium triangles: `27437`
- Total stadium draw calls: `55`
- Visible gameplay players: `0`
- Visible kickoff players: `0`
- Visible coin toss players: `0`
- Visible officials: `0`

## Decision

Layer 3 accepted by both screenshot QA and geometry review agents.

## Deferred Hardening

- Add more irregularity to the rear base band so it no longer reads as a straight wall.
- Patch remaining small blue slivers at tunnel/aisle openings, especially left bowl and scoreboard openings.
- Break up the dark side strip with subtle material variation, berm detail, service paths, or shadow gradients.
- Add future regression checks that skirt/base berm bounds never overlap field-branding rectangles or end zones.
