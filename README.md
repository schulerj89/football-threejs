# Football Three.js

Low-poly 3D American football prototype built with Three.js, Vite, and TypeScript.

The current milestone is a graybox field scene: a complete rectangular American-football field, two end zones, regular yard-line markings, a blue line of scrimmage, one controllable placeholder player, and a fixed orthographic three-quarter gameplay camera.

## World Scale

- `1 Three.js world unit = 1 yard`.
- The field is `120 x 53.33` units, matching a 100-yard playable field plus two 10-yard end zones.
- The `X` axis runs sideline to sideline, `Z` runs end zone to end zone, and `Y` is vertical.
- Direction of play is positive `Z`.
- The initial line of scrimmage is at `Z = -15`.

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
- Diagonal movement is normalized to the same max speed as cardinal movement.
- The player is clamped inside the playable field.

## Debug Overlay

Add `?debug=1` to the URL or press `D` to toggle the optional debug overlay. It shows FPS, placeholder player world coordinates, draw calls, and triangle count.

## Current Non-Goals

- No stadium
- No crowd
- No imported assets
- No ball behaviour
- No defender
- No sprinting
- No animation
- No AI
- No scoring
- No game rules
- No menus
- No physics engine
- No collision with other players
- No unrelated refactoring
