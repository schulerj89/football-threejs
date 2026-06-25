# Mountain Bowl Layer 1 - 1.22.85

## Scope

- Added the first procedural `mountainBowl` stadium theme layer behind the far bowl.
- Added a `stadiumPreview=1&stadiumTheme=mountainBowl` screenshot route that keeps field logos and end-zone branding visible while hiding gameplay actors and HUD overlays.
- Captured empty-field preview screenshots for review.

## Proof

- `mountain-bowl-layer-1-wide.png`
- `mountain-bowl-layer-1-ultrawide.png`
- `mountain-bowl-layer-1-debug-snapshot.json`

## Debug Snapshot Highlights

- `themeId`: `mountainBowl`
- Mountain ridges: `3`
- Mountain peaks: `24`
- Tree-line shapes: `24`
- Mountain-only triangles: `92`
- Visible gameplay players: `0`
- Visible kickoff players: `0`
- Visible coin toss players: `0`
- Visible officials: `0`

## Decision

Layer 1 accepted by both screenshot QA and geometry review agents.

## Deferred Hardening

- Soften the right-side vertical cutoff and slab-like mountain edges.
- Add more terrain variation, material contrast, and depth to snow caps.
- Continue closing or masking blue sky gaps around stadium concourse edges in later layers.
