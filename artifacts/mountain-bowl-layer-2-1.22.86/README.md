# Mountain Bowl Layer 2 - 1.22.86

## Scope

- Hardened the accepted Layer 1 mountain backdrop.
- Extended and feathered ridge endpoints past the preview frame to reduce hard vertical cutoffs.
- Lowered and varied ridge bases behind the stadium rim.
- Added low-cost rock facet overlays so the backdrop reads less like flat slabs.
- Tightened snow-cap geometry after an internal screenshot check showed overly wide cap shapes.

## Proof

- `mountain-bowl-layer-2-wide.png`
- `mountain-bowl-layer-2-ultrawide.png`
- `mountain-bowl-layer-2-debug-snapshot.json`

## Debug Snapshot Highlights

- `themeId`: `mountainBowl`
- Mountain ridges: `3`
- Mountain peaks: `33`
- Rock facets: `23`
- Tree-line shapes: `24`
- Mountain-only triangles: `133`
- Total stadium triangles: `27333`
- Total stadium draw calls: `48`
- Visible gameplay players: `0`
- Visible kickoff players: `0`
- Visible coin toss players: `0`
- Visible officials: `0`

## Decision

Layer 2 accepted by both screenshot QA and geometry review agents.

## Deferred Hardening

- Break up the straight dark base band behind the scoreboard and far-right horizon.
- Hide or darken exposed blue void strips around the outer bowl.
- Soften the rectangular terrain overlap behind the scoreboard/right ridge.
- Add explicit regression guards for mountain Z bounds, mountain triangle budget, draw-call budget, and zero visible field actors in preview mode.
