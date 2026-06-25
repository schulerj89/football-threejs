# Mountain Bowl Layer 4 - 1.22.88

## Scope

- Added service-lane, terrace-shelf, and retaining-wall geometry around the mountain-bowl site so the previous side and foreground dark mask reads more like intentional stadium infrastructure.
- Kept the scenic mountain bounds behind the far bowl while allowing site-detail geometry to wrap the stadium exterior.
- Preserved the empty-field preview requirement: no players or officials are visible, while field logos, yard numbers, goalposts, and end-zone branding remain visible.

## Proof

- `mountain-bowl-layer-4-wide.png`
- `mountain-bowl-layer-4-ultrawide.png`
- `mountain-bowl-layer-4-debug-snapshot.json`

## Debug Snapshot Highlights

- `themeId`: `mountainBowl`
- Service paths: `10`
- Terrace shelves: `5`
- Retaining wall panels: `7`
- Base berms: `3`
- Valley skirt segments: `4`
- Scenic min Z: `155.5`
- Mountain-only triangles: `281`
- Total stadium triangles: `27481`
- Total stadium draw calls: `77`
- Visible gameplay players: `0`
- Visible kickoff players: `0`
- Visible coin toss players: `0`
- Visible officials: `0`

## Decision

Layer 4 accepted by both screenshot QA and geometry review agents.

## Deferred Hardening

- Add curb, lane-line, railing, utility-door, or drainage-grate details to make the service lanes read better from lower camera angles.
- Add closer QA captures for near sideline, far bowl rim, corner openings, and end-zone branding occlusion.
- Re-check the mountain-to-bowl seam during the later player and pre-game validation pass.
