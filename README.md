# Football Three.js

Low-poly 3D American football prototype built with Three.js, Vite, and TypeScript.

The current milestone is a three-on-three rushing drill with a basic offensive drive: a graybox American-football field, one controllable placeholder ball carrier, two AI blockers, three AI defenders, downs, yards-to-go, first-down line, touchdown scoring, tackle and out-of-bounds outcomes, turnover-on-downs reset, dead-ball spotting, and a fixed orthographic three-quarter gameplay camera.

## World Scale

- `1 Three.js world unit = 1 yard`.
- The field is `120 x 53.33` units, matching a 100-yard playable field plus two 10-yard end zones.
- The `X` axis runs sideline to sideline, `Z` runs end zone to end zone, and `Y` is vertical.
- Direction of play is positive `Z`.
- The initial line of scrimmage is at `Z = -15`.
- World-unit to football-yard conversion is centralized in `src/fieldScale.ts`.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run test:unit
npm run test:smoke
npm test
```

Open the dev server at `http://127.0.0.1:5173`.

## Controls

- Move with `WASD` or the arrow keys.
- Press `Space` from pre-snap to start the play and give the player possession.
- Press `R` to reset the play to pre-snap.
- Cross the opposing goal line during a live play to score a touchdown.
- Avoid defenders to score; defender contact ends the play as a tackle.
- AI blockers move toward lane targets and can engage one defender each to slow pursuit.
- Crossing a sideline during a live play ends the play out of bounds.
- Tackle and out-of-bounds results display signed yards gained or lost, then reset the next play at the dead-ball spot.
- The drill tracks down, distance, ball position, and score.
- Reaching the first-down line resets to first-and-10; a failed fourth down shows `TURNOVER ON DOWNS` and starts a new offensive drill.
- Diagonal movement is normalized to the same max speed as cardinal movement.
- End-line movement is clamped; sidelines are live-play boundaries.

## Debug Overlay

Add `?debug=1` to the URL to show the optional debug overlay. It shows FPS, placeholder player world coordinates, draw calls, and triangle count.

## Current Non-Goals

- No stadium
- No crowd
- No imported assets
- No throwing
- No loose-ball physics
- No offensive linemen rules
- No holding penalties
- No pancake blocks
- No double-team blocks
- No pulling guards
- No diving tackles
- No tackling animations
- No passing
- No pathfinding library
- No sprinting
- No animation
- No quarters
- No game clock
- No play clock
- No punts
- No field goals
- No penalties
- No defensive possessions
- No celebration animation
- No stadium presentation
- No center or snap animation
- No full game rules
- No menus
- No force-based physics
- No ragdoll physics
- No unrelated refactoring
