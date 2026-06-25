# Mountain Bowl Final Validation Screenshot QA

## Reviewer

Screenshot QA agent `019effdd-7061-7e52-86ef-140f2d302eb8`.

## Evidence Reviewed

- `../mountain-bowl-final-pregame-warmup.png`
- `../mountain-bowl-final-gameplay-players.png`

## Verdict

ACCEPT

## Evidence

- Pregame warmup reads as a mountain-bowl stadium: enclosed seating, visible ridge silhouette beyond the bowl, field branding, end zones, center logo, goalposts, crowd bands, and warmup players are all visible.
- Gameplay preview shows the field populated with both teams, clear player silhouettes, line-of-scrimmage and first-down style markers, center logo, yard numbers, and end-zone branding.
- No obvious sky voids, missing bowl sections, or validation-blocking UI occlusion are visible. The hidden DOM HUD/play cards are acceptable for this visual proof.

## Issues

- Gameplay camera is tight enough that the mountain part of mountain-bowl is mostly implied by the enclosed stadium, not directly visible.
- Pregame presentation truncates team names, though the matchup card still reads as intentional and valid.
- Pregame overlay covers some upper-field and stand detail, but not enough to block validation.

## Deferred Hardening

- Add one populated-field wide gameplay capture that keeps the mountain rim visible.
- Improve matchup-card text fitting for longer team names.
- Keep debug JSON as the source of truth for runtime 22-player visibility, with screenshots used as visual confirmation only.
