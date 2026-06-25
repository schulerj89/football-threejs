# Mountain Bowl Layer 4 Geometry Review

## Reviewer

Geometry/shape review agent `019effd2-89ca-7a80-a9e1-ad62cd00d7cd`.

## Evidence Reviewed

- `../mountain-bowl-layer-4-wide.png`
- `../mountain-bowl-layer-4-ultrawide.png`
- `../mountain-bowl-layer-4-debug-snapshot.json`

## Verdict

ACCEPT with deferred hardening.

## Evidence

- Scenic mountains remain behind the far bowl: `scenicBounds.minZ=155.5`, while full layer bounds extend to `minZ=-168`; screenshots show ridges sitting beyond the upper bowl, not inside the field volume.
- Service paths and terrace shelves read as stadium site infrastructure around the seating bowl. They stay outside the playing surface and do not cover the midfield logo, yard numbers, end zone branding, or goalposts.
- Counts are reasonable: `servicePathCount=10`, `terraceShelfCount=5`, `retainingWallPanelCount=7`, `valleySkirtSegmentCount=4`, `baseBermCount=3`.
- Budget is acceptable: Layer 4 mountain geometry reports `triangleCount=281`; total stadium snapshot is still modest.
- Stage visible counts are all zero, as expected for this empty-field stadium debug capture.

## Issues

- No blocking geometry issues visible.
- Some terrace/path pieces are broad and low-detail, so they read more as simple site bands than finished concourse/service geometry.
- Mountain-to-bowl transitions are visually acceptable from these camera angles, but the seam should be checked from lower sideline and end-zone cameras later.

## Deferred Hardening

- Add closer QA angles for near sideline, far bowl rim, and end-zone branding occlusion.
- Confirm zero stage visibility again when moving into a separate stage/player pass.
- Later polish could add material variation or edge detail to service paths/terraces without changing placement.
