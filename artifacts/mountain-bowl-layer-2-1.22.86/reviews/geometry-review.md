# Geometry Review

## Verdict

ACCEPT for Layer 2.

## Evidence Reviewed

- `../mountain-bowl-layer-2-wide.png`
- `../mountain-bowl-layer-2-ultrawide.png`
- `../mountain-bowl-layer-2-debug-snapshot.json`

## Findings

- Mountain ridges remain behind the far bowl and upper rim in both screenshots.
- No mountain facets visibly intrude into field, seating, or scoreboard space.
- Field branding remains present and unobstructed.
- No player actors are visible in the screenshots.
- Snapshot supports the visual result:
  - `activePrimaryGroups`: `[]`
  - `gameplay.visibleCount`: `0`
  - `kickoff.visibleCount`: `0`
  - `coinToss.visibleCount`: `0`
  - `warmup.visibleFullProfileCount`: `0`
  - `normalOfficialsVisibleCount`: `0`

## Metrics

- Mountain-only triangles: `133`
- Mountain peaks: `33`
- Rock facets: `23`
- Tree-line shapes: `24`
- Total stadium draw calls: `48`
- Total stadium triangles: `27333`
- Geometry count: `42`
- Material count: `16`
- Texture count: `4`

## Hardening Notes

- Add explicit regression guards for mountain bounds staying beyond the far bowl rear Z threshold.
- Add budget checks for mountain triangle count and stadium draw calls.
- Keep both wide and ultrawide screenshots in future visual gates because ultrawide stresses right-side ridge feathering.

## Decision Log

- Accepted because the added facets and feathering remain bounded, behind the bowl, and validated by screenshots plus debug metrics.
