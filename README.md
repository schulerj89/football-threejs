# Football Three.js

Low-poly 3D American football prototype built with Three.js, Vite, and TypeScript.

The long-term target is a stylized low-poly 11v11 American-football game with cinematic and broadcast-style presentation. The current score-attack mode is a temporary gameplay test harness for validating controls, play states, formations, ball spotting, passing, tackling, downs, and camera language before the full game structure arrives.

The current milestone hardens fourteen-player presentation validation with `?presentationAudit=1`, checking visual grounding, helmet placement, procedural poses, camera framing, and render metrics for the development-only 7v7 preview. The active playable prototype remains a two-minute five-on-five offensive score-attack drill with semantic data-defined formations for Inside Run, Outside Run, Quick Pass, and Slant Flat, graphical pre-snap SVG play cards generated from gameplay data, visual-only procedural player poses and locomotion, and a basic offensive drive: a field generated from a pure field specification with batched static markings, turf bands, yard numbers, goalposts, sideline presentation, selectable play calls, quarterback scrambling with a line-of-scrimmage passing rule, route-running receiver behavior, selected-target passing with a deterministic arc, downs, yards-to-go, first-down line, touchdown scoring, sack, tackle, incomplete, and out-of-bounds outcomes, turnover-on-downs reset, exact dead-ball spotting with three-lane snap placement, final-score game over, a development-only `?formationPreview=7v7` staging mode, the preserved orthographic three-quarter camera, the behind-the-offense perspective camera, and the optional cinematic broadcast camera.

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
- Click or tap a pre-snap play card to select that play.
- Press `Space` from pre-snap to start the play and give the player possession.
- Press `E` before throwing on a passing play to cycle eligible receivers.
- Press `F` during a passing play to throw once toward the selected eligible receiver.
- Press `R` to reset the play to pre-snap.
- Press `Enter` from game over to restart the two-minute score attack.
- Press `C` in development or with `?debug=1` to cycle through tactical orthographic, behind-the-offense perspective, and cinematic broadcast cameras.
- Use `?camera=tactical`, `?camera=offense`, or `?camera=cinematic` to choose the starting camera mode.
- The graphical play cards are visible only during pre-snap and are generated from the same play definitions, resolved formation positions, routes, and blocker assignments used by gameplay.
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
- Each procedural low-poly player body keeps its gameplay-driven collision and movement while displaying a cloned `low_poly_helmet.glb` helmet attached to a head anchor.
- Use `?playerBody=mannequin` for the current low-poly silhouette or `?playerBody=box` for comparison with the earlier rectangular placeholder body.
- Use `?playerMotion=0` to disable visual-only procedural poses and locomotion for comparison.
- Use `?debugRoleColors=1` to restore role-colored player bodies for visual debugging.
- Use `?formationPreview=7v7` for the static fourteen-player development preview. In that mode, press `1` for left-hash staging, `2` for middle staging, and `3` for right-hash staging. Space does not start a play in preview mode.
- Use `?presentationAudit=1` with `?formationPreview=7v7` to show the 7v7 presentation audit. Add `?presentationState=locomotion` or press `L` for the visual-only locomotion preview; press `P` to return to pre-snap audit framing.
- Sack, tackle, completed pass, and out-of-bounds results display signed yards gained or lost from the exact dead-ball spot, then reset the next play at the nearest snap lane: left hash, middle, or right hash.
- Incomplete passes end the play at the original line of scrimmage and advance the down.
- The drill tracks down, distance, ball position, and score.
- The challenge tracks remaining time and final score.
- Reaching the first-down line resets to first-and-10; a failed fourth down shows `TURNOVER ON DOWNS` and starts a new offensive drill.
- Diagonal movement is normalized to the same max speed as cardinal movement.
- End-line movement is clamped; sidelines are live-play boundaries.

## Debug Overlay

Add `?debug=1` to the URL to show the optional debug overlay. It shows FPS, placeholder player world coordinates, draw calls, triangle count, frame time, geometry and texture counts, scene/player mesh counts, material counts, camera mode, camera state, focus position, camera position, cinematic presentation phase, cinematic look target, cinematic formation bounds, exact dead-ball spot, resolved next snap spot, snap lane, hash X positions, and formation origin.

Add `?poseDebug=1` to show every player's current visual pose intent and locomotion phase.

Add `?fieldAudit=1` to show field geometry validation helpers: authoritative field bounds, inner marking bounds, corner markers, and red highlighting for any painted marking that escapes the field surface.

Add `?formationAudit=1` to show the resolved semantic formation: snap lane, field/boundary side, player positions, lateral/depth offsets, and any validation issues highlighted in red.

Add `?presentationAudit=1` to show the development-only presentation audit for 7v7 preview scenarios. It reports snap lane, audit state, camera mode, presentation phase, visual-bound framing, grounding, helmet attachment and gap checks, frame time, draw calls, triangles, player mesh count, material count, and any presentation validation issues.

## Current Non-Goals And Future Scope

- Presentation future scope: stadium, crowd, stadium seating, sideline characters, advertisements, weather, field degradation, turf redesign, and broader stadium presentation are planned later, not permanent exclusions.
- Roster future scope: active 7v7 play, 11v11, full special teams, additional offensive or defensive gameplay players beyond the current five-on-five drill, player switching, and formations beyond the current Inside Run, Outside Run, Quick Pass, Slant Flat, and static 7v7 preview data are deferred.
- Assets and animation future scope: imported full-body player models, skeletal animation, quarterback animation, scramble animation, tackling animation, celebration animation, and center or snap animation are deferred. The current milestone intentionally uses procedural low-poly silhouettes plus the reusable low-poly helmet.
- Play calling: no large playbook menu, title screen, audibles, defensive play selection, route editor, procedural play generation, hot routes, or menus beyond the current pre-snap play cards and minimal HUD/debug displays.
- Passing and ball outcomes: no interceptions, fumbles, loose-ball physics, manual aiming, pass-type selection, pump fake, illegal-forward-pass penalty, referee logic, user-controlled catch mechanic, contested-catch ratings, or quarterback ratings.
- Blocking and tackling: no offensive linemen rules, holding penalties, pancake blocks, double-team blocks, pulling guards, diving tackles, advanced pursuit/pathfinding library, or physics-driven contact.
- Game structure: no quarters, opponent score, halftime, timeouts, NFL clock-stoppage rules, play clock, punts, field goals, penalties, defensive possessions, full game rules, season modes, or franchise systems.
- Controls and camera: no sprinting, stamina, freely rotating camera, camera-relative controls, instant replay, replay recording, camera collision, or camera redesign beyond the current tactical, offense-perspective, and cinematic broadcast modes.
- Simulation architecture: no force-based physics, ragdoll physics, general-purpose physics engine, advanced AI rewrite, or unrelated refactoring.
