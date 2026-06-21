# Football Three.js

Low-poly 3D American football prototype built with Three.js, Vite, and TypeScript.

The current milestone is a two-minute three-on-three offensive score-attack drill with two data-defined rushing plays, two passing plays, primitive player bodies with cloned low-poly helmet visuals, and a basic offensive drive: a field generated from a pure field specification with batched static markings, turf bands, yard numbers, goalposts, sideline presentation, placeholder players, selectable Inside Run, Outside Run, Quick Pass, and Slant Flat play calls, quarterback scrambling with a line-of-scrimmage passing rule, route-running receiver behavior, selected-target passing with a deterministic arc, downs, yards-to-go, first-down line, touchdown scoring, sack, tackle, incomplete, and out-of-bounds outcomes, turnover-on-downs reset, exact dead-ball spotting with three-lane snap placement, final-score game over, the preserved orthographic three-quarter camera, and an optional behind-the-offense perspective camera.

## World Scale

- `1 Three.js world unit = 1 yard`.
- The field is `120 x 53.33` units, matching a 100-yard playable field plus two 10-yard end zones.
- The `X` axis runs sideline to sideline, `Z` runs end zone to end zone, and `Y` is vertical.
- Direction of play is positive `Z`.
- The initial line of scrimmage is at `Z = -15`.
- Field dimensions, paint widths, field bounds, playable bounds, and plain layout data are centralized in `src/fieldSpec.ts`.
- Static field markings are batched by material while the line of scrimmage, first-down line, and play-direction marker remain dynamic.
- Yard numbers face the sidelines, and the presentation-only goalposts sit on the end lines at the back of each end zone.
- Painted hash marks and snap-placement hash lanes share the same widened arcade hash X value derived from the professional hash position.
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
- Press `1` during pre-snap to select `Inside Run`.
- Press `2` during pre-snap to select `Outside Run`.
- Press `3` during pre-snap to select `Quick Pass`.
- Press `4` during pre-snap to select `Slant Flat`.
- Press `Space` from pre-snap to start the play and give the player possession.
- Press `E` before throwing on a passing play to cycle eligible receivers.
- Press `F` during a passing play to throw once toward the selected eligible receiver.
- Press `R` to reset the play to pre-snap.
- Press `Enter` from game over to restart the two-minute score attack.
- Press `C` in development or with `?debug=1` to toggle between the tactical orthographic camera and the behind-the-offense perspective camera.
- Use `?camera=tactical` or `?camera=offense` to choose the starting camera mode.
- Play selection is locked while a play is live; reset preserves the selected play.
- The HUD shows the selected target for passing plays.
- The score-attack clock starts on the first snap, runs continuously after that, and clamps at `0:00`.
- If time expires during a live play, that play may finish before game over.
- Passing plays start with the quarterback in possession; after a catch, possession and user control transfer to the receiver.
- The quarterback may scramble before throwing.
- Crossing the original line of scrimmage permanently disables forward passing for that play; pressing `F` after crossing shows `PAST LINE OF SCRIMMAGE` and does not throw.
- Before a throw, ordinary defenders rush the quarterback; contact behind the line of scrimmage ends the play as a sack.
- Cross the opposing goal line during a live play to score a touchdown.
- Avoid defenders to score; defender contact ends the play as a tackle.
- AI blockers move toward lane targets and can engage one defender each to slow pursuit.
- Coverage defenders track their assigned receivers while ordinary defenders use the existing simple pursuit or pass-rush behavior.
- Crossing a sideline during a live play ends the play out of bounds.
- AI-controlled non-carriers stay inside the playable field while the active ball carrier may cross a sideline to end the play.
- Each primitive player body keeps its gameplay-driven collision and movement while displaying a cloned `low_poly_helmet.glb` helmet attached to a head anchor.
- Sack, tackle, completed pass, and out-of-bounds results display signed yards gained or lost from the exact dead-ball spot, then reset the next play at the nearest snap lane: left hash, middle, or right hash.
- Incomplete passes end the play at the original line of scrimmage and advance the down.
- The drill tracks down, distance, ball position, and score.
- The challenge tracks remaining time and final score.
- Reaching the first-down line resets to first-and-10; a failed fourth down shows `TURNOVER ON DOWNS` and starts a new offensive drill.
- Diagonal movement is normalized to the same max speed as cardinal movement.
- End-line movement is clamped; sidelines are live-play boundaries.

## Debug Overlay

Add `?debug=1` to the URL to show the optional debug overlay. It shows FPS, placeholder player world coordinates, draw calls, triangle count, camera mode, camera state, focus position, camera position, exact dead-ball spot, resolved next snap spot, snap lane, hash X positions, and formation origin.

Add `?fieldAudit=1` to show field geometry validation helpers: authoritative field bounds, inner marking bounds, corner markers, and red highlighting for any painted marking that escapes the field surface.

## Current Non-Goals

- Presentation: no stadium, crowd, stadium seating, sideline characters, advertisements, weather, field degradation, turf redesign, or stadium presentation.
- Roster scope: no 4v4, 5v5, full special teams, additional offensive or defensive players, player switching, or formations beyond the current Inside Run, Outside Run, Quick Pass, and Slant Flat play data.
- Assets and animation: no imported assets beyond the current reusable low-poly helmet, no full player models replacing primitive bodies, no imported animations, no quarterback animation, no scramble animation, no tackling animation, no celebration animation, and no center or snap animation.
- Play calling: no large play-calling menu, audibles, defensive play selection, route editor, procedural play generation, hot routes, or menus beyond the current minimal HUD/debug displays.
- Passing and ball outcomes: no interceptions, fumbles, loose-ball physics, manual aiming, pass-type selection, pump fake, illegal-forward-pass penalty, referee logic, user-controlled catch mechanic, contested-catch ratings, or quarterback ratings.
- Blocking and tackling: no offensive linemen rules, holding penalties, pancake blocks, double-team blocks, pulling guards, diving tackles, advanced pursuit/pathfinding library, or physics-driven contact.
- Game structure: no quarters, opponent score, halftime, timeouts, NFL clock-stoppage rules, play clock, punts, field goals, penalties, defensive possessions, full game rules, season modes, or franchise systems.
- Controls and camera: no sprinting, stamina, freely rotating camera, camera-relative controls, cinematic replay system, or camera redesign beyond the current tactical and offense-perspective modes.
- Simulation architecture: no force-based physics, ragdoll physics, general-purpose physics engine, advanced AI rewrite, or unrelated refactoring.
