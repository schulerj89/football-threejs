import * as THREE from 'three';
import type { PlayerModel } from '../../playerModel';
import {
  PLAYER_BODY_ROOT_NAME,
  type PlayerTeamUniforms,
} from '../../playerVisual';
import type { UniformPalette } from '../../teams/UniformPalette';
import {
  getPlayerAppearanceMaterial,
  type PlayerAppearanceMaterialRegion,
} from './PlayerAppearancePalette';
import {
  cloneRiggedPlayerTemplate,
  getRiggedPlayerAssetSnapshot,
} from './RiggedPlayerAssetLibrary';
import {
  createRiggedPlayerAttachmentAnchors,
} from './PlayerAttachmentController';

export interface RiggedPlayerVisualDescriptor {
  appearanceId: string;
  gameplayPlayerId?: string;
  jerseyNumber?: number | null;
  rosterPlayerId: string;
  uniform: UniformPalette;
  visualId: string;
}

export interface RiggedPlayerVisualController {
  fallbackReason: string | null;
  root: THREE.Group;
  sync: (
    player: PlayerModel,
    descriptor: Pick<RiggedPlayerVisualDescriptor, 'appearanceId' | 'uniform'>,
    teamUniforms?: PlayerTeamUniforms,
  ) => void;
}

const REGION_BY_MATERIAL_NAME: Array<readonly [RegExp, PlayerAppearanceMaterialRegion]> = [
  [/skin/i, 'skin'],
  [/jersey/i, 'jersey'],
  [/pants|socks/i, 'pants_socks'],
  [/shoe/i, 'shoes'],
];

export function createRiggedPlayerVisual(
  player: PlayerModel,
  descriptor: RiggedPlayerVisualDescriptor,
  teamUniforms?: PlayerTeamUniforms,
): RiggedPlayerVisualController | null {
  const clonedTemplate = cloneRiggedPlayerTemplate(`rigged-player-template-${descriptor.visualId}`);
  if (!clonedTemplate) {
    const snapshot = getRiggedPlayerAssetSnapshot();
    return snapshot.status === 'error'
      ? createUnavailableController(`rigged asset unavailable: ${snapshot.errorMessage ?? 'unknown error'}`)
      : null;
  }

  const root = new THREE.Group();
  root.name = `rigged-football-player-${descriptor.visualId}`;
  root.userData.playerVisualMode = 'meshyRigged';
  root.userData.playerBodyStyle = 'meshyRigged';
  root.userData.riggedPlayerVisual = true;
  root.userData.riggedPlayerFallbackReason = null;

  const bodyRoot = new THREE.Group();
  bodyRoot.name = PLAYER_BODY_ROOT_NAME;
  bodyRoot.userData.riggedPlayerBodyRoot = true;
  bodyRoot.add(clonedTemplate);
  root.add(bodyRoot);
  createRiggedPlayerAttachmentAnchors(bodyRoot);
  tagAndMaterializeRiggedMeshes(bodyRoot, descriptor.appearanceId, descriptor.uniform);
  syncRiggedRoot(root, player);

  return {
    fallbackReason: null,
    root,
    sync: (nextPlayer, nextDescriptor) => {
      syncRiggedRoot(root, nextPlayer);
      tagAndMaterializeRiggedMeshes(
        bodyRoot,
        nextDescriptor.appearanceId,
        nextDescriptor.uniform,
      );
    },
  };
}

export function getRiggedPlayerSkeletonSnapshot(root: THREE.Object3D): {
  boneCount: number;
  skinnedMeshCount: number;
  skeletonUuids: string[];
} {
  const skeletonUuids: string[] = [];
  let boneCount = 0;
  let skinnedMeshCount = 0;
  root.traverse((object) => {
    if (object instanceof THREE.Bone) {
      boneCount += 1;
    }
    if (object instanceof THREE.SkinnedMesh) {
      skinnedMeshCount += 1;
      skeletonUuids.push(object.skeleton.uuid);
    }
  });
  return {
    boneCount,
    skeletonUuids: skeletonUuids.sort(),
    skinnedMeshCount,
  };
}

function createUnavailableController(reason: string): RiggedPlayerVisualController {
  const root = new THREE.Group();
  root.userData.riggedPlayerFallbackReason = reason;
  return {
    fallbackReason: reason,
    root,
    sync: () => undefined,
  };
}

function syncRiggedRoot(root: THREE.Group, player: PlayerModel): void {
  root.userData.sourcePlayerId = player.id;
  root.position.set(player.position.x, 0, player.position.z);
  root.rotation.y = player.facingRadians;
}

function tagAndMaterializeRiggedMeshes(
  bodyRoot: THREE.Object3D,
  appearanceId: string,
  uniform: UniformPalette,
): void {
  bodyRoot.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    object.castShadow = false;
    object.receiveShadow = false;
    object.frustumCulled = true;
    object.userData.riggedPlayerBodyMesh = true;
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
    const nextMaterials = sourceMaterials.map((material) => {
      const region = resolveMaterialRegion(material.name || object.name);
      object.userData.uniformPart = region === 'pants_socks' ? 'pants' : region;
      return getPlayerAppearanceMaterial(region, {
        appearanceId,
        uniform,
      });
    });
    object.material = Array.isArray(object.material) ? nextMaterials : nextMaterials[0];
  });
}

function resolveMaterialRegion(name: string): PlayerAppearanceMaterialRegion {
  for (const [pattern, region] of REGION_BY_MATERIAL_NAME) {
    if (pattern.test(name)) {
      return region;
    }
  }

  return 'jersey';
}
