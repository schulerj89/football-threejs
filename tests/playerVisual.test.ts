import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createPlayerModel } from '../src/playerModel';
import {
  PLAYER_BODY_DIMENSIONS,
  PLAYER_BODY_ROOT_NAME,
  PLAYER_HEAD_ANCHOR_NAME,
  createPlaceholderPlayerVisual,
  getPlayerBodyVisualSnapshot,
  resolvePlayerBodyVisualStyle,
  syncPlayerVisual,
} from '../src/playerVisual';

describe('player visual', () => {
  it('creates the low-poly mannequin hierarchy under the existing player root', () => {
    const player = createPlayerModel(undefined, {
      id: 'offense-qb',
      role: 'quarterback',
      team: 'offense',
    });
    const playerVisual = createPlaceholderPlayerVisual(player);
    const bodyRoot = playerVisual.getObjectByName(PLAYER_BODY_ROOT_NAME);

    expect(playerVisual.name).toBe('player-offense-qb');
    expect(playerVisual.userData.testId).toBe('player-offense-qb');
    expect(bodyRoot).toBeInstanceOf(THREE.Group);
    expect(bodyRoot?.parent).toBe(playerVisual);
    expect(bodyRoot?.getObjectByName('torso')).toBeInstanceOf(THREE.Mesh);
    expect(bodyRoot?.getObjectByName('shoulderPads')).toBeInstanceOf(THREE.Mesh);
    expect(bodyRoot?.getObjectByName('leftArmPivot')).toBeInstanceOf(THREE.Group);
    expect(bodyRoot?.getObjectByName('rightArmPivot')).toBeInstanceOf(THREE.Group);
    expect(bodyRoot?.getObjectByName('leftLegPivot')).toBeInstanceOf(THREE.Group);
    expect(bodyRoot?.getObjectByName('rightLegPivot')).toBeInstanceOf(THREE.Group);
    expect(bodyRoot?.getObjectByName('leftFoot')).toBeInstanceOf(THREE.Mesh);
    expect(bodyRoot?.getObjectByName('rightFoot')).toBeInstanceOf(THREE.Mesh);
    expect(bodyRoot?.getObjectByName(PLAYER_HEAD_ANCHOR_NAME)).toBeInstanceOf(THREE.Group);
  });

  it('keeps the mannequin inexpensive while measuring the football silhouette', () => {
    const player = createPlayerModel(undefined, {
      id: 'offense-rb',
      role: 'runner',
      team: 'offense',
    });
    const playerVisual = createPlaceholderPlayerVisual(player);

    syncPlayerVisual(playerVisual, player);

    const snapshot = getPlayerBodyVisualSnapshot(playerVisual);

    expect(snapshot.bodyStyle).toBe('mannequin');
    expect(snapshot.totalHeight).toBe(PLAYER_BODY_DIMENSIONS.totalHeight);
    expect(snapshot.shoulderWidth).toBe(PLAYER_BODY_DIMENSIONS.shoulderWidth);
    expect(snapshot.meshesPerPlayer).toBe(8);
    expect(snapshot.bodyTriangleCount).toBeGreaterThanOrEqual(300);
    expect(snapshot.bodyTriangleCount).toBeLessThanOrEqual(700);
    expect(snapshot.bodyBounds.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(snapshot.bodyBounds.size.y).toBeGreaterThan(1.8);
    expect(snapshot.bodyBounds.size.y).toBeLessThanOrEqual(PLAYER_BODY_DIMENSIONS.totalHeight);
  });

  it('shares primitive body geometry across players', () => {
    const runnerVisual = createPlaceholderPlayerVisual(
      createPlayerModel(undefined, { id: 'runner-a', role: 'runner', team: 'offense' }),
    );
    const blockerVisual = createPlaceholderPlayerVisual(
      createPlayerModel(undefined, { id: 'blocker-a', role: 'blocker', team: 'offense' }),
    );
    const runnerTorso = runnerVisual.getObjectByName('torso');
    const blockerTorso = blockerVisual.getObjectByName('torso');

    expect(runnerTorso).toBeInstanceOf(THREE.Mesh);
    expect(blockerTorso).toBeInstanceOf(THREE.Mesh);
    expect((runnerTorso as THREE.Mesh).geometry).toBe((blockerTorso as THREE.Mesh).geometry);
  });

  it('uses team colors by default and role colors only for explicit debug mode', () => {
    const offenseRunner = createPlayerModel(undefined, {
      id: 'offense-runner',
      role: 'runner',
      team: 'offense',
    });
    const offenseBlocker = createPlayerModel(undefined, {
      id: 'offense-blocker',
      role: 'blocker',
      team: 'offense',
    });
    const defenseRunner = createPlayerModel(undefined, {
      id: 'defense-runner',
      role: 'runner',
      team: 'defense',
    });
    const offenseRunnerVisual = createPlaceholderPlayerVisual(offenseRunner);
    const offenseBlockerVisual = createPlaceholderPlayerVisual(offenseBlocker);
    const defenseRunnerVisual = createPlaceholderPlayerVisual(defenseRunner);
    const debugRunnerVisual = createPlaceholderPlayerVisual(offenseRunner, {
      debugRoleColors: true,
    });
    const debugBlockerVisual = createPlaceholderPlayerVisual(offenseBlocker, {
      debugRoleColors: true,
    });

    expect(getMeshColorHex(offenseRunnerVisual, 'torso')).toBe(
      getMeshColorHex(offenseBlockerVisual, 'torso'),
    );
    expect(getMeshColorHex(offenseRunnerVisual, 'torso')).not.toBe(
      getMeshColorHex(defenseRunnerVisual, 'torso'),
    );
    expect(getMeshColorHex(debugRunnerVisual, 'torso')).not.toBe(
      getMeshColorHex(debugBlockerVisual, 'torso'),
    );
  });

  it('supports the box comparison option without changing the root sync path', () => {
    const player = createPlayerModel(undefined, {
      id: 'box-player',
      role: 'runner',
      team: 'offense',
    });
    const playerVisual = createPlaceholderPlayerVisual(player, { bodyStyle: 'box' });

    syncPlayerVisual(playerVisual, player);

    expect(resolvePlayerBodyVisualStyle('box')).toBe('box');
    expect(resolvePlayerBodyVisualStyle('mannequin')).toBe('mannequin');
    expect(resolvePlayerBodyVisualStyle('unexpected')).toBe('mannequin');
    expect(playerVisual.getObjectByName('placeholder-player-body')).toBeInstanceOf(THREE.Mesh);
    expect(playerVisual.getObjectByName(PLAYER_HEAD_ANCHOR_NAME)).toBeInstanceOf(THREE.Group);
    expect(getPlayerBodyVisualSnapshot(playerVisual).bodyStyle).toBe('box');
    expect(playerVisual.position.x).toBe(player.position.x);
    expect(playerVisual.position.z).toBe(player.position.z);
    expect(playerVisual.rotation.y).toBe(player.facingRadians);
  });
});

function getMeshColorHex(playerVisual: THREE.Object3D, meshName: string): number {
  const mesh = playerVisual.getObjectByName(meshName);

  if (!(mesh instanceof THREE.Mesh) || !(mesh.material instanceof THREE.MeshLambertMaterial)) {
    throw new Error(`Missing lambert mesh ${meshName}`);
  }

  return mesh.material.color.getHex();
}
