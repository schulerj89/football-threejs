# Geometry Review

## Verdict

ACCEPT for Layer 1.

## Evidence Reviewed

- `../mountain-bowl-layer-1-wide.png`
- `../mountain-bowl-layer-1-ultrawide.png`
- `../mountain-bowl-layer-1-debug-snapshot.json`

## Findings

- The mountain backdrop is behind the far bowl and reads as scenic background geometry, not field or seating geometry.
- Field branding remains present: midfield logo, `SUMMIT` end zones, yard numbers, hash marks, and goalposts are visible.
- No player actors are visible in the screenshots.
- Snapshot supports the visual review:
  - `activePrimaryGroups`: `[]`
  - `gameplay.visibleCount`: `0`
  - `kickoff.visibleCount`: `0`
  - `normalOfficialsVisibleCount`: `0`
- Metrics are bounded for a first procedural layer:
  - total stadium triangles: `27292`
  - mountain-only triangles: `92`
  - draw calls: `45`
  - texture count: `4`
  - mountain bounds: `X -178..166`, `Z 196..270`, `Y 2..66.38`

## Hardening Notes

- Future geometry layers should feather, extend, or curve the backdrop perimeter to remove the visible slab cutoff.
- Snow caps are readable but flat; later layers should add depth or surface-following placement.
- Add a regression check that the mountain min Z stays behind the far bowl and does not intrude into seating or field space.

## Decision Log

- Accepted because the layer is isolated, bounded, behind the bowl, visually apparent, and validated by screenshots plus debug metrics.
