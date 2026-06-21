import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  SKIN_TONE_PALETTE,
  resolvePlayerAppearance,
} from '../src/playerAppearance';
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
import { FIVE_ON_FIVE_PLAYER_IDS } from '../src/roster';
import { DEFAULT_USER_TEAM_ID } from '../src/teams/TeamRegistry';
import {
  DEFAULT_TEAM_PROFILE_SETTINGS,
  updateTeamColorOverride,
} from '../src/teams/TeamProfileStore';
import { resolveTeamPresentationTheme } from '../src/teams/TeamThemeApplier';

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
    expect(bodyRoot?.getObjectByName('jerseyTexturePanel')).toBeInstanceOf(THREE.Mesh);
    expect(bodyRoot?.getObjectByName('shoulderPads')).toBeInstanceOf(THREE.Mesh);
    expect(bodyRoot?.getObjectByName('leftArmPivot')).toBeInstanceOf(THREE.Group);
    expect(bodyRoot?.getObjectByName('rightArmPivot')).toBeInstanceOf(THREE.Group);
    expect(bodyRoot?.getObjectByName('leftLegPivot')).toBeInstanceOf(THREE.Group);
    expect(bodyRoot?.getObjectByName('rightLegPivot')).toBeInstanceOf(THREE.Group);
    expect(bodyRoot?.getObjectByName('leftFoot')).toBeInstanceOf(THREE.Mesh);
    expect(bodyRoot?.getObjectByName('rightFoot')).toBeInstanceOf(THREE.Mesh);
    const headAnchor = bodyRoot?.getObjectByName(PLAYER_HEAD_ANCHOR_NAME);
    expect(headAnchor).toBeInstanceOf(THREE.Group);
    expect(headAnchor?.getObjectByName('head')).toBeInstanceOf(THREE.Mesh);
    expect(headAnchor?.getObjectByName('neck')).toBeInstanceOf(THREE.Mesh);
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
    expect(snapshot.meshesPerPlayer).toBe(11);
    expect(snapshot.bodyTriangleCount).toBeGreaterThanOrEqual(300);
    expect(snapshot.bodyTriangleCount).toBeLessThanOrEqual(700);
    expect(snapshot.bodyBounds.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(snapshot.minimumBodyY).toBeGreaterThanOrEqual(-0.001);
    expect(snapshot.bodyBounds.size.y).toBeGreaterThan(1.45);
    expect(snapshot.bodyBounds.size.y).toBeLessThanOrEqual(PLAYER_BODY_DIMENSIONS.totalHeight);
    expect(snapshot.uniqueBodyGeometryCount).toBe(8);
    expect(snapshot.uniqueBodyMaterialCount).toBe(6);
    expect(snapshot.headBounds).not.toBeNull();
    expect(snapshot.neckBounds).not.toBeNull();
    expect(snapshot.appearance).toEqual(resolvePlayerAppearance(player.id));
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

  it('applies custom team uniform palettes without changing skin tones', () => {
    const teamProfiles = updateTeamColorOverride(
      DEFAULT_TEAM_PROFILE_SETTINGS,
      DEFAULT_USER_TEAM_ID,
      {
        faceguard: '#333333',
        helmetShell: '#654321',
        pants: '#abcdef',
        primary: '#123456',
        secondary: '#fedcba',
      },
    );
    const theme = resolveTeamPresentationTheme(teamProfiles);
    const player = createPlayerModel(undefined, {
      id: 'custom-uniform-runner',
      role: 'runner',
      team: 'offense',
    });
    const playerVisual = createPlaceholderPlayerVisual(player, {
      teamUniforms: theme.uniforms,
    });

    expect(getMeshColorHex(playerVisual, 'torso')).toBe(0x123456);
    expect(getMeshColorHex(playerVisual, 'shoulderPads')).toBe(0x123456);
    expect(getMeshColorHex(playerVisual, 'leftLeg')).toBe(0xabcdef);
    expect(getMeshSkinToneId(playerVisual, 'head')).toBe(
      resolvePlayerAppearance(player.id).skinToneId,
    );
  });

  it('adds a shared image-textured jersey panel without replacing the primitive body', () => {
    const offenseVisual = createPlaceholderPlayerVisual(
      createPlayerModel(undefined, { id: 'offense-qb', role: 'quarterback', team: 'offense' }),
    );
    const defenseVisual = createPlaceholderPlayerVisual(
      createPlayerModel(undefined, { id: 'defense-qb', role: 'defender', team: 'defense' }),
    );
    const offensePanel = getMesh(offenseVisual, 'jerseyTexturePanel');
    const defensePanel = getMesh(defenseVisual, 'jerseyTexturePanel');

    expect(offenseVisual.getObjectByName('torso')).toBeInstanceOf(THREE.Mesh);
    expect(offensePanel.geometry).toBe(defensePanel.geometry);
    expect(offensePanel.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(defensePanel.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect((offensePanel.material as THREE.MeshBasicMaterial).map).toBeInstanceOf(THREE.DataTexture);
    expect((defensePanel.material as THREE.MeshBasicMaterial).map).toBeInstanceOf(THREE.DataTexture);
    expect(offensePanel.material).not.toBe(defensePanel.material);
  });

  it('reuses cached body material references when material inputs are unchanged', () => {
    const player = createPlayerModel(undefined, {
      id: 'cached-sync-runner',
      role: 'runner',
      team: 'offense',
    });
    const playerVisual = createPlaceholderPlayerVisual(player);
    const bodyRoot = playerVisual.getObjectByName(PLAYER_BODY_ROOT_NAME);

    syncPlayerVisual(playerVisual, player);
    const torsoMaterial = getMeshMaterial(playerVisual, 'torso');
    const originalPlayerTraverse = playerVisual.traverse;
    const originalBodyTraverse = bodyRoot?.traverse;
    const failTraverse = (() => {
      throw new Error('syncPlayerVisual should use cached body references');
    }) as typeof playerVisual.traverse;

    playerVisual.traverse = failTraverse;
    if (bodyRoot) {
      bodyRoot.traverse = failTraverse;
    }

    try {
      syncPlayerVisual(playerVisual, player);
    } finally {
      playerVisual.traverse = originalPlayerTraverse;
      if (bodyRoot && originalBodyTraverse) {
        bodyRoot.traverse = originalBodyTraverse;
      }
    }

    expect(getMeshMaterial(playerVisual, 'torso')).toBe(torsoMaterial);

    syncPlayerVisual(playerVisual, { ...player, team: 'defense' });

    expect(getMeshMaterial(playerVisual, 'torso')).not.toBe(torsoMaterial);
    expect(getMeshColorHex(playerVisual, 'torso')).toBe(0xf2f4f6);
  });

  it('keeps shared team material counts bounded across an active roster', () => {
    const theme = resolveTeamPresentationTheme(DEFAULT_TEAM_PROFILE_SETTINGS);
    const players = [
      ...Array.from({ length: 11 }, (_, index) =>
        createPlayerModel(undefined, {
          id: `offense-material-${index}`,
          role: index === 0 ? 'quarterback' : 'blocker',
          team: 'offense',
        }),
      ),
      ...Array.from({ length: 11 }, (_, index) =>
        createPlayerModel(undefined, {
          id: `defense-material-${index}`,
          role: 'defender',
          team: 'defense',
        }),
      ),
    ];
    const materialIds = new Set<string>();

    for (const player of players) {
      const visual = createPlaceholderPlayerVisual(player, {
        teamUniforms: theme.uniforms,
      });
      visual.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          materialIds.add((object.material as THREE.Material).uuid);
        }
      });
    }

    expect(materialIds.size).toBeLessThanOrEqual(18);
  });

  it('resolves deterministic skin tones from stable player identity only', () => {
    const first = resolvePlayerAppearance('offense-qb');
    const second = resolvePlayerAppearance('offense-qb');
    const sameIdDifferentRole = createPlaceholderPlayerVisual(
      createPlayerModel(undefined, {
        id: 'stable-identity',
        role: 'quarterback',
        team: 'offense',
      }),
    );
    const sameIdDifferentTeam = createPlaceholderPlayerVisual(
      createPlayerModel(undefined, {
        id: 'stable-identity',
        role: 'defender',
        team: 'defense',
      }),
    );
    const rosterSkinToneIds = new Set(
      FIVE_ON_FIVE_PLAYER_IDS.map((playerId) => resolvePlayerAppearance(playerId).skinToneId),
    );

    expect(first).toEqual(second);
    expect(SKIN_TONE_PALETTE.map((tone) => tone.skinToneId)).toContain(first.skinToneId);
    expect(getMeshSkinToneId(sameIdDifferentRole, 'head')).toBe(
      getMeshSkinToneId(sameIdDifferentTeam, 'head'),
    );
    expect(rosterSkinToneIds.size).toBeGreaterThanOrEqual(3);
  });

  it('shares skin materials by palette entry and applies one tone to exposed skin meshes', () => {
    const [firstId, secondId] = findMatchingSkinToneIds();
    const firstVisual = createPlaceholderPlayerVisual(
      createPlayerModel(undefined, { id: firstId, role: 'runner', team: 'offense' }),
    );
    const secondVisual = createPlaceholderPlayerVisual(
      createPlayerModel(undefined, { id: secondId, role: 'receiver', team: 'defense' }),
    );
    const skinMeshes = ['head', 'neck', 'leftArm', 'rightArm'];
    const firstSkinMaterial = getMeshMaterial(firstVisual, 'head');

    for (const meshName of skinMeshes) {
      expect(getMeshSkinToneId(firstVisual, meshName)).toBe(resolvePlayerAppearance(firstId).skinToneId);
      expect(getMeshMaterial(firstVisual, meshName)).toBe(firstSkinMaterial);
    }

    expect(getMeshMaterial(secondVisual, 'head')).toBe(firstSkinMaterial);
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

function getMeshMaterial(playerVisual: THREE.Object3D, meshName: string): THREE.Material {
  return getMesh(playerVisual, meshName).material as THREE.Material;
}

function getMeshSkinToneId(playerVisual: THREE.Object3D, meshName: string): string {
  return String(getMesh(playerVisual, meshName).userData.skinToneId);
}

function getMesh(playerVisual: THREE.Object3D, meshName: string): THREE.Mesh {
  const mesh = playerVisual.getObjectByName(meshName);

  if (!(mesh instanceof THREE.Mesh)) {
    throw new Error(`Missing mesh ${meshName}`);
  }

  return mesh;
}

function findMatchingSkinToneIds(): [string, string] {
  const byTone = new Map<string, string>();

  for (let index = 0; index < 100; index += 1) {
    const playerId = `skin-test-${index}`;
    const toneId = resolvePlayerAppearance(playerId).skinToneId;
    const existingPlayerId = byTone.get(toneId);

    if (existingPlayerId) {
      return [existingPlayerId, playerId];
    }

    byTone.set(toneId, playerId);
  }

  throw new Error('Unable to find matching deterministic skin tone IDs');
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
