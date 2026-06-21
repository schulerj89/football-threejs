# Football Three.js

Low-poly 3D American football prototype built with Three.js, Vite, and TypeScript.

The current milestone is a two-minute three-on-three offensive score-attack drill with two data-defined rushing plays, two passing plays, primitive player bodies with cloned low-poly helmet visuals, and a basic offensive drive: a graybox American-football field, placeholder players, selectable Inside Run, Outside Run, Quick Pass, and Slant Flat play calls, quarterback scrambling with a line-of-scrimmage passing rule, route-running receiver behavior, selected-target passing with a deterministic arc, downs, yards-to-go, first-down line, touchdown scoring, sack, tackle, incomplete, and out-of-bounds outcomes, turnover-on-downs reset, dead-ball spotting, final-score game over, and a fixed orthographic three-quarter gameplay camera.

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
- Press `1` during pre-snap to select `Inside Run`.
- Press `2` during pre-snap to select `Outside Run`.
- Press `3` during pre-snap to select `Quick Pass`.
- Press `4` during pre-snap to select `Slant Flat`.
- Press `Space` from pre-snap to start the play and give the player possession.
- Press `E` before throwing on a passing play to cycle eligible receivers.
- Press `F` during a passing play to throw once toward the selected eligible receiver.
- Press `R` to reset the play to pre-snap.
- Press `Enter` from game over to restart the two-minute score attack.
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
- Sack, tackle, completed pass, and out-of-bounds results display signed yards gained or lost, then reset the next play at the dead-ball spot.
- Incomplete passes end the play at the original line of scrimmage and advance the down.
- The drill tracks down, distance, ball position, and score.
- The challenge tracks remaining time and final score.
- Reaching the first-down line resets to first-and-10; a failed fourth down shows `TURNOVER ON DOWNS` and starts a new offensive drill.
- Diagonal movement is normalized to the same max speed as cardinal movement.
- End-line movement is clamped; sidelines are live-play boundaries.

## Debug Overlay

Add `?debug=1` to the URL to show the optional debug overlay. It shows FPS, placeholder player world coordinates, draw calls, and triangle count.

## Current Non-Goals

- No stadium
- No crowd
- No imported assets beyond the current reusable low-poly helmet
- No loose-ball physics
- No large play-calling menu
- No audibles
- No defensive play selection
- No interceptions
- No four-on-four
- No manual aiming
- No hot routes
- No bullet/lob selection
- No pump fake
- No illegal-forward-pass penalty
- No referee logic
- No scramble animation
- No blitz selection
- No user-controlled catch mechanic
- No contested-catch ratings
- No quarterback animations
- No route editor
- No procedural play generation
- No additional formations beyond the current four plays
- No offensive linemen rules
- No holding penalties
- No pancake blocks
- No double-team blocks
- No pulling guards
- No diving tackles
- No tackling animations
- No pathfinding library
- No sprinting
- No animation
- No quarters
- No opponent score
- No halftime
- No timeouts
- No NFL clock-stoppage rules
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
