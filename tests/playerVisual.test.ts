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
    expect(snapshot.minimumBodyY).toBeGreaterThanOrEqual(-0.001);
    expect(snapshot.bodyBounds.size.y).toBeGreaterThan(1.45);
    expect(snapshot.bodyBounds.size.y).toBeLessThanOrEqual(PLAYER_BODY_DIMENSIONS.totalHeight);
    expect(snapshot.uniqueBodyGeometryCount).toBe(5);
    expect(snapshot.uniqueBodyMaterialCount).toBe(4);
  });

  it('mirrors left and right limbs and keeps both feet on the field surface', () => {
    const player = createPlayerModel(undefined, {
      id: 'symmetry-player',
      role: 'runner',
      team: 'offense',
    });
    const playerVisual = createPlaceholderPlayerVisual(player);

    syncPlayerVisual(playerVisual, player);

    const leftArmPivot = getGroup(playerVisual, 'leftArmPivot');
    const rightArmPivot = getGroup(playerVisual, 'rightArmPivot');
    const leftLegPivot = getGroup(playerVisual, 'leftLegPivot');
    const rightLegPivot = getGroup(playerVisual, 'rightLegPivot');
    const leftArmBounds = getObjectBounds(playerVisual, 'leftArm');
    const rightArmBounds = getObjectBounds(playerVisual, 'rightArm');
    const leftLegBounds = getObjectBounds(playerVisual, 'leftLeg');
    const rightLegBounds = getObjectBounds(playerVisual, 'rightLeg');
    const leftFootBounds = getObjectBounds(playerVisual, 'leftFoot');
    const rightFootBounds = getObjectBounds(playerVisual, 'rightFoot');

    expect(leftArmPivot.position.x).toBeCloseTo(-rightArmPivot.position.x);
    expect(leftLegPivot.position.x).toBeCloseTo(-rightLegPivot.position.x);
    expect(leftArmBounds.size.x).toBeCloseTo(rightArmBounds.size.x);
    expect(leftArmBounds.size.y).toBeCloseTo(rightArmBounds.size.y);
    expect(leftArmBounds.size.z).toBeCloseTo(rightArmBounds.size.z);
    expect(leftLegBounds.size.x).toBeCloseTo(rightLegBounds.size.x);
    expect(leftLegBounds.size.y).toBeCloseTo(rightLegBounds.size.y);
    expect(leftLegBounds.size.z).toBeCloseTo(rightLegBounds.size.z);
    expect(leftFootBounds.min.y).toBeCloseTo(0);
    expect(rightFootBounds.min.y).toBeCloseTo(0);
  });

  it('keeps every mannequin role at the same measured dimensions', () => {
    const players = [
      createPlayerModel(undefined, { id: 'runner-a', role: 'runner', team: 'offense' }),
      createPlayerModel(undefined, { id: 'blocker-a', role: 'blocker', team: 'offense' }),
      createPlayerModel(undefined, { id: 'receiver-a', role: 'receiver', team: 'offense' }),
      createPlayerModel(undefined, { id: 'defender-a', role: 'defender', team: 'defense' }),
      createPlayerModel(undefined, {
        id: 'coverage-a',
        role: 'coverageDefender',
        team: 'defense',
      }),
    ];
    const snapshots = players.map((player) => {
      const playerVisual = createPlaceholderPlayerVisual(player);
      syncPlayerVisual(playerVisual, player);
      return getPlayerBodyVisualSnapshot(playerVisual);
    });
    const first = snapshots[0];

    for (const snapshot of snapshots) {
      expect(snapshot.bodyBounds.size.x).toBeCloseTo(first.bodyBounds.size.x);
      expect(snapshot.bodyBounds.size.y).toBeCloseTo(first.bodyBounds.size.y);
      expect(snapshot.bodyBounds.size.z).toBeCloseTo(first.bodyBounds.size.z);
      expect(snapshot.meshesPerPlayer).toBe(first.meshesPerPlayer);
      expect(snapshot.bodyTriangleCount).toBe(first.bodyTriangleCount);
    }
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

function getGroup(playerVisual: THREE.Object3D, groupName: string): THREE.Group {
  const group = playerVisual.getObjectByName(groupName);

  if (!(group instanceof THREE.Group)) {
    throw new Error(`Missing group ${groupName}`);
  }

  return group;
}

function getObjectBounds(playerVisual: THREE.Object3D, objectName: string): {
  min: THREE.Vector3;
  size: THREE.Vector3;
} {
  const object = playerVisual.getObjectByName(objectName);

  if (!object) {
    throw new Error(`Missing object ${objectName}`);
  }

  playerVisual.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  return {
    min: box.min,
    size: box.getSize(new THREE.Vector3()),
  };
}
