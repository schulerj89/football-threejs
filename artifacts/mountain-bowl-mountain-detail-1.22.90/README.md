# Mountain Bowl Mountain Detail - 1.22.90

## Scope

- Rebuilt the `mountainBowl` ridge sheets as subdivided, faceted low-poly mountain surfaces.
- Raised the mountain-only geometry from a few hundred triangles to a measured `21,993` triangles.
- Added per-vertex ridge shading and flat-shaded facets so the mountains read less plain while keeping the stadium shell unchanged.

## Proof

- `mountain-bowl-detail-wide.png`
- `mountain-bowl-detail-close.png`
- `mountain-bowl-detail-debug-snapshot.json`

## Debug Snapshot Highlights

- `themeId`: `mountainBowl`
- Mountain-only triangles: `21,993`
- Total stadium triangles: `49,193`
- Scenic min Z: `155.5`
- Service paths: `10`
- Terrace shelves: `5`
- Retaining wall panels: `7`
- Visible gameplay players in empty preview: `0`

## Notes

- This changes mountain detail only. The stadium seating bowl is still the existing stadium shell.
