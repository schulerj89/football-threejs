import { describe, expect, it } from 'vitest';
import { PLAYABLE_FIELD_BOUNDS } from '../src/field';
import { normalizeMovementInput } from '../src/input';
import {
  PLAYER_MOVEMENT_CONFIG,
  createPlayerModel,
  type PlayerModel,
  type Vector2,
} from '../src/playerModel';
import { updatePlayerSimulation } from '../src/playerSimulation';

const FRAME_DELTA = 1 / 60;

describe('player movement simulation', () => {
  it('normalizes diagonal input so it is not faster than cardinal input', () => {
    const forwardInput = normalizeMovementInput({ x: 0, z: 1 });
    const diagonalInput = normalizeMovementInput({ x: 1, z: 1 });
    expect(vectorLength(diagonalInput)).toBeCloseTo(1);

    const forwardPlayer = createPlayerModel();
    const diagonalPlayer = createPlayerModel();

    updatePlayerSimulation(forwardPlayer, forwardInput, 0.1, PLAYABLE_FIELD_BOUNDS);
    updatePlayerSimulation(diagonalPlayer, diagonalInput, 0.1, PLAYABLE_FIELD_BOUNDS);
    expect(speedOf(diagonalPlayer)).toBeCloseTo(speedOf(forwardPlayer), 5);

    stepForSeconds(forwardPlayer, forwardInput, 2);
    stepForSeconds(diagonalPlayer, diagonalInput, 2);
    expect(speedOf(forwardPlayer)).toBeCloseTo(PLAYER_MOVEMENT_CONFIG.maxSpeed, 5);
    expect(speedOf(diagonalPlayer)).toBeCloseTo(PLAYER_MOVEMENT_CONFIG.maxSpeed, 5);
  });

  it.each([
    ['left', { x: -1, z: 0 }, 'x', -1],
    ['right', { x: 1, z: 0 }, 'x', 1],
    ['backward', { x: 0, z: -1 }, 'z', -1],
    ['forward', { x: 0, z: 1 }, 'z', 1],
  ] as const)('moves %s from input', (_name, input, axis, sign) => {
    const player = createPlayerModel();
    const start = player.position[axis];

    stepForSeconds(player, input, 0.4);

    expect(Math.sign(player.position[axis] - start)).toBe(sign);
  });

  it('decelerates to a stop when input is released', () => {
    const player = createPlayerModel();

    stepForSeconds(player, { x: 0, z: 1 }, 0.5);
    expect(speedOf(player)).toBeGreaterThan(0);

    stepForSeconds(player, { x: 0, z: 0 }, 1);

    expect(speedOf(player)).toBeCloseTo(0, 5);
  });

  it('updates facing toward movement direction', () => {
    const player = createPlayerModel();

    updatePlayerSimulation(player, { x: 1, z: 0 }, FRAME_DELTA, PLAYABLE_FIELD_BOUNDS);
    expect(player.facingRadians).toBeCloseTo(Math.PI / 2);

    updatePlayerSimulation(player, { x: 0, z: -1 }, FRAME_DELTA, PLAYABLE_FIELD_BOUNDS);
    expect(player.facingRadians).toBeCloseTo(Math.PI);
  });

  it('keeps the player inside playable field boundaries', () => {
    const maxCornerPlayer = createPlayerModel();
    const minCornerPlayer = createPlayerModel();
    const minCenterX = PLAYABLE_FIELD_BOUNDS.minX + PLAYER_MOVEMENT_CONFIG.halfWidth;
    const maxCenterX = PLAYABLE_FIELD_BOUNDS.maxX - PLAYER_MOVEMENT_CONFIG.halfWidth;
    const minCenterZ = PLAYABLE_FIELD_BOUNDS.minZ + PLAYER_MOVEMENT_CONFIG.halfDepth;
    const maxCenterZ = PLAYABLE_FIELD_BOUNDS.maxZ - PLAYER_MOVEMENT_CONFIG.halfDepth;

    stepForSeconds(maxCornerPlayer, { x: 1, z: 1 }, 12);
    stepForSeconds(minCornerPlayer, { x: -1, z: -1 }, 12);

    expect(maxCornerPlayer.position.x).toBeLessThanOrEqual(maxCenterX);
    expect(maxCornerPlayer.position.z).toBeLessThanOrEqual(maxCenterZ);
    expect(maxCornerPlayer.position.x).toBeCloseTo(maxCenterX);
    expect(maxCornerPlayer.position.z).toBeCloseTo(maxCenterZ);
    expect(minCornerPlayer.position.x).toBeGreaterThanOrEqual(minCenterX);
    expect(minCornerPlayer.position.z).toBeGreaterThanOrEqual(minCenterZ);
    expect(minCornerPlayer.position.x).toBeCloseTo(minCenterX);
    expect(minCornerPlayer.position.z).toBeCloseTo(minCenterZ);
  });

  it('can allow sideline crossing for gameplay out-of-bounds detection', () => {
    const player = createPlayerModel();
    player.position.x = PLAYABLE_FIELD_BOUNDS.maxX - PLAYER_MOVEMENT_CONFIG.halfWidth - 0.1;

    updatePlayerSimulation(player, { x: 1, z: 0 }, 0.1, PLAYABLE_FIELD_BOUNDS, {
      clampSidelines: false,
    });

    expect(player.position.x + PLAYER_MOVEMENT_CONFIG.halfWidth).toBeGreaterThan(
      PLAYABLE_FIELD_BOUNDS.maxX,
    );
  });
});

function stepForSeconds(player: PlayerModel, input: Vector2, seconds: number): void {
  const steps = Math.ceil(seconds / FRAME_DELTA);

  for (let step = 0; step < steps; step += 1) {
    updatePlayerSimulation(player, input, FRAME_DELTA, PLAYABLE_FIELD_BOUNDS);
  }
}

function speedOf(player: PlayerModel): number {
  return vectorLength(player.velocity);
}

function vectorLength(vector: Vector2): number {
  return Math.hypot(vector.x, vector.z);
}
