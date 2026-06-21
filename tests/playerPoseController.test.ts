import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { GameplaySnapshot, PlayState } from '../src/playState';
import type { PlayerSnapshot } from '../src/playerModel';
import { createPlaceholderPlayerVisual, syncPlayerVisual } from '../src/playerVisual';
import {
  PLAYER_POSE_CONFIG,
  PlayerPoseController,
  calculateStablePhaseOffset,
  calculateStridePhaseAdvance,
  createPoseTarget,
  derivePlayerPoseIntent,
} from '../src/presentation/PlayerPoseController';

describe('player pose controller', () => {
  it('selects offensive and defensive ready poses during pre-snap', () => {
    expect(derivePlayerPoseIntent(createPlayer({ team: 'offense' }), 'preSnap')).toBe(
      'readyOffense',
    );
    expect(derivePlayerPoseIntent(createPlayer({ team: 'defense' }), 'preSnap')).toBe(
      'readyDefense',
    );
  });

  it('selects locomotion for moving active players', () => {
    const player = createPlayer({
      currentState: 'userControlled',
      velocity: { x: 0, z: 6 },
    });

    expect(derivePlayerPoseIntent(player, 'live')).toBe('locomotion');
  });

  it('returns stationary players to their team ready pose', () => {
    const player = createPlayer({
      currentState: 'userControlled',
      team: 'defense',
      velocity: { x: 0.01, z: 0 },
    });

    expect(derivePlayerPoseIntent(player, 'live')).toBe('readyDefense');
  });

  it('uses equal stride rates for equal velocities', () => {
    const first = calculateStridePhaseAdvance(0, 8, 0.05);
    const second = calculateStridePhaseAdvance(0, 8, 0.05);
    const slower = calculateStridePhaseAdvance(0, 4, 0.05);

    expect(first).toBeCloseTo(second);
    expect(first).toBeCloseTo(slower * 2);
  });

  it('uses deterministic phase offsets from stable player IDs', () => {
    expect(calculateStablePhaseOffset('offense-qb')).toBeCloseTo(
      calculateStablePhaseOffset('offense-qb'),
    );
    expect(calculateStablePhaseOffset('offense-qb')).not.toBeCloseTo(
      calculateStablePhaseOffset('defense-safety'),
    );
  });

  it('opposes arm and leg phases during locomotion within safe limits', () => {
    const pose = createPoseTarget('locomotion', Math.PI / 2);

    expect(pose.leftLegRotationX).toBeGreaterThan(0);
    expect(pose.rightLegRotationX).toBeLessThan(0);
    expect(pose.leftArmRotationX).toBeLessThan(0);
    expect(pose.rightArmRotationX).toBeGreaterThan(0);
    expect(Math.abs(pose.leftLegRotationX)).toBeLessThanOrEqual(
      PLAYER_POSE_CONFIG.safeLimits.legRotationX,
    );
    expect(Math.abs(pose.rightArmRotationX)).toBeLessThanOrEqual(
      PLAYER_POSE_CONFIG.safeLimits.armRotationX,
    );
  });

  it('does not mutate gameplay snapshots or authoritative root transforms', () => {
    const player = createPlayer({
      currentState: 'userControlled',
      velocity: { x: 0, z: 7 },
    });
    const gameplay = createGameplaySnapshot([player], 'live');
    const beforeGameplay = JSON.stringify(gameplay);
    const visual = createPlaceholderPlayerVisual(player);

    syncPlayerVisual(visual, player);
    const beforePosition = visual.position.clone();
    const beforeRotationY = visual.rotation.y;

    const controller = new PlayerPoseController();
    controller.update(gameplay, new Map([[player.id, visual]]), 0.1);

    expect(JSON.stringify(gameplay)).toBe(beforeGameplay);
    expect(visual.position.equals(beforePosition)).toBe(true);
    expect(visual.rotation.y).toBe(beforeRotationY);
    expect(visual.getObjectByName('leftLegPivot')?.rotation.x).not.toBe(0);
  });

  it('can disable procedural motion for comparison', () => {
    const player = createPlayer({
      currentState: 'userControlled',
      velocity: { x: 0, z: 7 },
    });
    const visual = createPlaceholderPlayerVisual(player);
    const controller = new PlayerPoseController(undefined, { enabled: false });

    controller.update(createGameplaySnapshot([player], 'live'), new Map([[player.id, visual]]), 0.1);

    expect(controller.getPoseSnapshots()).toMatchObject([
      {
        intent: 'neutral',
        playerId: player.id,
      },
    ]);
    expect(visual.getObjectByName('leftLegPivot')?.rotation.equals(new THREE.Euler())).toBe(true);
  });
});

function createPlayer(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    collisionRadius: 0.75,
    currentState: 'idle',
    facingRadians: 0,
    id: 'test-player',
    position: { x: 0, z: -20 },
    role: 'runner',
    team: 'offense',
    velocity: { x: 0, z: 0 },
    ...overrides,
  };
}

function createGameplaySnapshot(
  players: PlayerSnapshot[],
  playState: PlayState,
): GameplaySnapshot {
  return {
    playState,
    players,
  } as unknown as GameplaySnapshot;
}
