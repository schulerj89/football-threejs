# Geometry Review

## Verdict

ACCEPT for Layer 3.

## Evidence Reviewed

- `../mountain-bowl-layer-3-wide.png`
- `../mountain-bowl-layer-3-ultrawide.png`
- `../mountain-bowl-layer-3-debug-snapshot.json`

## Findings

- Scenic mountains and berms remain visually behind the far bowl in both screenshots.
- No ridge appears to intrude into the field bowl or seating face.
- Valley and side skirt masking stays outside field branding.
- The `SUMMIT` end zone, midfield logo, yard numbers, and sideline markings remain unobstructed.
- No player actors are visible.
- Snapshot supports the result:
  - `gameplay.visibleCount`: `0`
  - `kickoff.visibleCount`: `0`
  - `coinToss.visibleCount`: `0`
  - `warmup.visibleFullProfileCount`: `0`
  - `normalOfficialsVisibleCount`: `0`

## Metrics

- Scenic min Z: `155.5`
- Base berms: `3`
- Valley skirt segments: `4`
- Mountain-only triangles: `237`
- Total stadium draw calls: `55`
- Total stadium triangles: `27437`
- Geometry count: `49`

## Hardening Notes

- Keep an invariant that scenic ridge `scenicBounds.minZ` stays behind the far bowl by a fixed margin.
- Add future regression checks that skirt/base berm bounds never overlap field-branding rectangles or end zones.
- Keep ultrawide coverage in the snapshot set because it stresses side skirt and right-side ridge drift.

## Decision Log

- Accepted because the scenic geometry remains behind the bowl, the skirt stays outside field branding, and the added geometry remains bounded.
