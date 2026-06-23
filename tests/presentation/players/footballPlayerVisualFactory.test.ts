import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  FOOTBALL_PLAYER_VISUAL_PROFILE_ID,
  createFootballPlayerVisual,
  type FootballPlayerVisualDescriptor,
} from '../../../src/presentation/players/FootballPlayerVisualFactory';
import {
  resetRiggedPlayerAssetLibraryForTest,
  setRiggedPlayerTemplateForTest,
} from '../../../src/presentation/players/RiggedPlayerAssetLibrary';
import {
  getRiggedPlayerSkeletonSnapshot,
} from '../../../src/presentation/players/RiggedPlayerVisualFactory';
import {
  FRONT_JERSEY_NUMBER_MESH_NAME,
  JERSEY_NUMBER_MESH_NAME,
  getJerseyNumberMaterialSnapshot,
} from '../../../src/presentation/players/JerseyNumberVisual';
import { getJerseyNumberAtlasSnapshot } from '../../../src/presentation/players/JerseyNumberAtlas';
import { getJerseyNumberGeometrySnapshot } from '../../../src/presentation/players/JerseyNumberGeometryCache';
import {
  DEFAULT_PLAYER_TEAM_UNIFORMS,
  PLAYER_BODY_ROOT_NAME,
  getPlayerVisualHeadAnchor,
} from '../../../src/playerVisual';
import type { PlayerModel } from '../../../src/playerModel';
import type { PlayerTeamUniforms } from '../../../src/playerVisual';

function createDescriptor(overrides: Partial<FootballPlayerVisualDescriptor> = {}): FootballPlayerVisualDescriptor {
  return {
    appearanceId: 'roster-qb-1',
    footballPosition: 'QB',
    gameplayPlayerId: 'offense-qb',
    gameplayTeam: 'offense',
    presentationOnly: false,
    role: 'quarterback',
    jerseyNumber: 12,
    rosterPlayerId: 'roster-qb-1',
    teamSide: 'user',
    uniform: DEFAULT_PLAYER_TEAM_UNIFORMS.offense,
    visualId: 'offense-qb',
    ...overrides,
  };
}

async function attachMockHelmet(
  playerVisual: THREE.Object3D,
  _player: PlayerModel,
  _teamUniforms?: PlayerTeamUniforms,
): Promise<boolean> {
  const headAnchor = getPlayerVisualHeadAnchor(playerVisual);
  if (!headAnchor) {
    return false;
  }
  const helmet = new THREE.Group();
  helmet.name = 'low-poly-helmet';
  headAnchor.add(helmet);
  return true;
}

describe('FootballPlayerVisualFactory', () => {
  it('creates a full mannequin player with body, head anchor, and helmet', async () => {
    const resource = createFootballPlayerVisual(createDescriptor(), {
      attachHelmet: attachMockHelmet,
    });

    await resource.ready;

    expect(resource.root.userData.fullFootballPlayerVisual).toBe(true);
    expect(resource.root.userData.visualProfileId).toBe(FOOTBALL_PLAYER_VISUAL_PROFILE_ID);
    expect(resource.root.userData.presentationOnly).toBe(false);
    expect(resource.root.getObjectByName(PLAYER_BODY_ROOT_NAME)).toBeTruthy();
    expect(getPlayerVisualHeadAnchor(resource.root)).toBeTruthy();
    expect(resource.root.getObjectByName('low-poly-helmet')).toBeTruthy();
    expect(resource.getSnapshot().helmetAttached).toBe(true);

    resource.dispose();
  });

  it('syncs transform, uniform, pose, and visibility through the resource contract', async () => {
    const resource = createFootballPlayerVisual(createDescriptor(), {
      attachHelmet: attachMockHelmet,
    });

    await resource.ready;
    resource.syncTransform({ x: 4, z: -12 }, Math.PI / 4);
    resource.syncUniform({
      ...DEFAULT_PLAYER_TEAM_UNIFORMS.offense,
      helmetShell: '#123456',
      jersey: '#123456',
    });
    resource.setPose('readyOffense');
    resource.setVisible(false);

    const snapshot = resource.getSnapshot();
    expect(snapshot.visualProfileId).toBe(FOOTBALL_PLAYER_VISUAL_PROFILE_ID);
    expect(snapshot.rootPosition).toEqual({ x: 4, y: 1.1, z: -12 });
    expect(snapshot.facingRadians).toBeCloseTo(Math.PI / 4);
    expect(snapshot.poseIntent).toBe('readyOffense');
    expect(snapshot.visible).toBe(false);

    resource.dispose();
  });

  it('marks presentation-only visuals without assigning gameplay authority', async () => {
    const resource = createFootballPlayerVisual(
      createDescriptor({
        gameplayPlayerId: undefined,
        presentationOnly: true,
        visualId: 'pregame-qb-clone',
      }),
      {
        attachHelmet: attachMockHelmet,
      },
    );

    await resource.ready;
    const snapshot = resource.getSnapshot();
    expect(snapshot.presentationOnly).toBe(true);
    expect(snapshot.gameplayPlayerId).toBeNull();
    expect(resource.root.userData.presentationOnly).toBe(true);
    expect(resource.root.userData.gameplayPlayerId).toBeNull();

    resource.dispose();
  });

  it('attaches roster-driven front and back jersey numbers through the shared atlas', async () => {
    const resource = createFootballPlayerVisual(createDescriptor({ jerseyNumber: 12 }), {
      attachHelmet: attachMockHelmet,
    });

    await resource.ready;

    const backNumberMesh = resource.root.getObjectByName(JERSEY_NUMBER_MESH_NAME);
    const frontNumberMesh = resource.root.getObjectByName(FRONT_JERSEY_NUMBER_MESH_NAME);
    const snapshot = resource.getSnapshot().jerseyNumber;

    expect(backNumberMesh).toBeInstanceOf(THREE.Mesh);
    expect(frontNumberMesh).toBeInstanceOf(THREE.Mesh);
    expect(backNumberMesh?.userData.excludeFromPlayerBodyBounds).toBe(true);
    expect(frontNumberMesh?.userData.excludeFromPlayerBodyBounds).toBe(true);
    expect(backNumberMesh?.userData.jerseyNumberSide).toBe('back');
    expect(frontNumberMesh?.userData.jerseyNumberSide).toBe('front');
    expect(snapshot).toMatchObject({
      backVisible: true,
      frontVisible: true,
      jerseyNumber: 12,
      materialId: 'jersey-number:#f2f4f6',
      missingBindingReason: null,
      rosterPlayerId: 'roster-qb-1',
      visible: true,
      visibleMeshCount: 2,
      visualId: 'offense-qb',
    });
    expect(snapshot.atlasCell).toMatchObject({ column: 2, row: 1 });
    expect(snapshot.backAnchorPosition).not.toBeNull();
    expect(snapshot.frontAnchorPosition).not.toBeNull();
    expect(getJerseyNumberAtlasSnapshot()).toMatchObject({
      atlasCreated: true,
      cellCount: 100,
      textureSize: 1024,
    });

    resource.dispose();
  });

  it('supports single-digit numbers without forced leading zeroes', async () => {
    const resource = createFootballPlayerVisual(createDescriptor({
      jerseyNumber: 5,
      rosterPlayerId: 'roster-rb-5',
      visualId: 'offense-rb',
    }), {
      attachHelmet: attachMockHelmet,
    });

    await resource.ready;

    const snapshot = resource.getSnapshot().jerseyNumber;
    expect(snapshot.jerseyNumber).toBe(5);
    expect(snapshot.atlasCell).toMatchObject({ column: 5, row: 0 });

    resource.dispose();
  });

  it('reuses number geometry and materials instead of allocating per player', async () => {
    const first = createFootballPlayerVisual(createDescriptor({
      jerseyNumber: 12,
      visualId: 'offense-qb-a',
    }), {
      attachHelmet: attachMockHelmet,
    });
    const second = createFootballPlayerVisual(createDescriptor({
      jerseyNumber: 12,
      visualId: 'offense-qb-b',
    }), {
      attachHelmet: attachMockHelmet,
    });

    await Promise.all([first.ready, second.ready]);

    const firstMesh = first.root.getObjectByName(JERSEY_NUMBER_MESH_NAME);
    const secondMesh = second.root.getObjectByName(JERSEY_NUMBER_MESH_NAME);
    const firstFrontMesh = first.root.getObjectByName(FRONT_JERSEY_NUMBER_MESH_NAME);

    expect(firstMesh).toBeInstanceOf(THREE.Mesh);
    expect(secondMesh).toBeInstanceOf(THREE.Mesh);
    expect(firstFrontMesh).toBeInstanceOf(THREE.Mesh);
    expect((firstMesh as THREE.Mesh).geometry).toBe((secondMesh as THREE.Mesh).geometry);
    expect((firstMesh as THREE.Mesh).geometry).toBe((firstFrontMesh as THREE.Mesh).geometry);
    expect((firstMesh as THREE.Mesh).material).toBe((secondMesh as THREE.Mesh).material);
    expect((firstMesh as THREE.Mesh).material).toBe((firstFrontMesh as THREE.Mesh).material);
    expect(getJerseyNumberGeometrySnapshot().cachedNumbers).toContain(12);
    expect(getJerseyNumberMaterialSnapshot().materialCount).toBeGreaterThanOrEqual(1);
    expect(getJerseyNumberMaterialSnapshot().materialIds).toContain('jersey-number:#f2f4f6');

    first.dispose();
    second.dispose();
  });

  it('hides jersey numbers when no roster number is bound', async () => {
    const resource = createFootballPlayerVisual(createDescriptor({
      jerseyNumber: null,
      rosterPlayerId: 'anonymous-full-player',
      visualId: 'anonymous-full-player',
    }), {
      attachHelmet: attachMockHelmet,
    });

    await resource.ready;

    expect(resource.root.getObjectByName(JERSEY_NUMBER_MESH_NAME)).toBeUndefined();
    expect(resource.root.getObjectByName(FRONT_JERSEY_NUMBER_MESH_NAME)).toBeUndefined();
    expect(resource.getSnapshot().jerseyNumber).toMatchObject({
      backVisible: false,
      frontVisible: false,
      jerseyNumber: null,
      missingBindingReason: 'missingNumber',
      rosterPlayerId: 'anonymous-full-player',
      visible: false,
      visibleMeshCount: 0,
      visualId: 'anonymous-full-player',
    });

    resource.dispose();
  });

  it('can create rigged Meshy-mode players with independent skeletons and shared geometry', async () => {
    resetRiggedPlayerAssetLibraryForTest();
    setRiggedPlayerTemplateForTest(createRiggedPlayerTemplateForTest());

    const first = createFootballPlayerVisual(createDescriptor({
      visualId: 'rigged-a',
    }), {
      attachHelmet: attachMockHelmet,
      playerVisualOptions: {
        visualMode: 'meshyRigged',
      },
    });
    const second = createFootballPlayerVisual(createDescriptor({
      visualId: 'rigged-b',
    }), {
      attachHelmet: attachMockHelmet,
      playerVisualOptions: {
        visualMode: 'meshyRigged',
      },
    });

    await Promise.all([first.ready, second.ready]);

    const firstMesh = findSkinnedMesh(first.root);
    const secondMesh = findSkinnedMesh(second.root);
    const firstSnapshot = first.getSnapshot();
    const secondSnapshot = second.getSnapshot();

    expect(firstSnapshot.visualMode).toBe('meshyRigged');
    expect(firstSnapshot.body.bodyStyle).toBe('meshyRigged');
    expect(firstSnapshot.body.minimumBodyY).toBeGreaterThanOrEqual(-0.001);
    expect(firstSnapshot.helmetAttached).toBe(true);
    expect(first.root.getObjectByName(JERSEY_NUMBER_MESH_NAME)).toBeInstanceOf(THREE.Mesh);
    expect(first.root.getObjectByName(FRONT_JERSEY_NUMBER_MESH_NAME)).toBeInstanceOf(THREE.Mesh);
    expect(first.getReadiness()).toMatchObject({
      bodyReady: true,
      helmetReady: true,
      playerAssetStatus: 'loaded',
      subjectReady: true,
    });
    expect(firstMesh).toBeInstanceOf(THREE.SkinnedMesh);
    expect(secondMesh).toBeInstanceOf(THREE.SkinnedMesh);
    expect(firstMesh.geometry).toBe(secondMesh.geometry);
    expect(firstMesh.skeleton).not.toBe(secondMesh.skeleton);
    expect(getRiggedPlayerSkeletonSnapshot(first.root)).toMatchObject({
      boneCount: 2,
      skinnedMeshCount: 1,
    });
    expect(secondSnapshot.visualMode).toBe('meshyRigged');

    first.dispose();
    second.dispose();
    resetRiggedPlayerAssetLibraryForTest();
  });

  it('falls back to procedural players when Meshy rigged assets are unavailable', async () => {
    resetRiggedPlayerAssetLibraryForTest();

    const resource = createFootballPlayerVisual(createDescriptor({
      visualId: 'rigged-unavailable',
    }), {
      attachHelmet: attachMockHelmet,
      playerVisualOptions: {
        visualMode: 'meshyRigged',
      },
    });

    await resource.ready;

    expect(resource.root.userData.requestedPlayerVisualMode).toBe('meshyRigged');
    expect(resource.getSnapshot().visualMode).toBe('procedural');
    expect(resource.getSnapshot().body.bodyStyle).toBe('mannequin');

    resource.dispose();
  });
});

function createRiggedPlayerTemplateForTest(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'test-rigged-player-template';

  const hips = new THREE.Bone();
  hips.name = 'hips';
  hips.position.set(0, 0, 0);
  const head = new THREE.Bone();
  head.name = 'head';
  head.position.set(0, 1.58, 0);
  hips.add(head);

  const helmetSocket = new THREE.Group();
  helmetSocket.name = 'socket_helmet';
  helmetSocket.position.set(0, 0.1, 0);
  head.add(helmetSocket);

  const shoulderSocket = new THREE.Group();
  shoulderSocket.name = 'socket_shoulder_pads';
  shoulderSocket.position.set(0, 1.1, 0);
  hips.add(shoulderSocket);

  const geometry = new THREE.BoxGeometry(0.8, 1.85, 0.35);
  geometry.translate(0, 0.925, 0);
  const vertexCount = geometry.getAttribute('position').count;
  const skinIndices: number[] = [];
  const skinWeights: number[] = [];
  for (let index = 0; index < vertexCount; index += 1) {
    skinIndices.push(0, 0, 0, 0);
    skinWeights.push(1, 0, 0, 0);
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  const material = new THREE.MeshLambertMaterial({ color: 0x777777 });
  material.name = 'mat_player_jersey';
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = 'player_body_skinned';
  mesh.add(hips);
  mesh.bind(new THREE.Skeleton([hips, head]));
  root.add(mesh);

  return root;
}

function findSkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh {
  let skinnedMesh: THREE.SkinnedMesh | null = null;
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh && !skinnedMesh) {
      skinnedMesh = object;
    }
  });
  if (!skinnedMesh) {
    throw new Error('Missing skinned mesh');
  }
  return skinnedMesh;
}
