import * as THREE from 'three';
import { CROWD_PREVIEW_CONFIG } from './CrowdConfiguration';
import { createCrowdPlacements } from './CrowdLayout';
import {
  countCrowdDrawCalls,
  countCrowdTriangles,
  estimateInstanceBufferBytes,
} from './CrowdMetrics';
import type { CrowdPreviewPlacement, CrowdResources } from './CrowdTypes';

export interface CrowdColorOptions {
  accentColors?: readonly number[];
}

export function createCrowdResources(
  requestedCount: number,
  options: CrowdColorOptions = {},
): CrowdResources {
  const placements = createCrowdPlacements(requestedCount);
  const nearPlacements = placements.filter((placement) => placement.lod === 'near');
  const farPlacements = placements.filter((placement) => placement.lod === 'far');
  const group = new THREE.Group();
  group.name = 'crowd-preview';

  const geometries = createSharedCrowdGeometries();
  const materials = createSharedCrowdMaterials();

  const detailedTorso = new THREE.InstancedMesh(geometries.torso, materials.uniform, nearPlacements.length);
  const detailedHead = new THREE.InstancedMesh(geometries.head, materials.skin, nearPlacements.length);
  const detailedArmLeft = new THREE.InstancedMesh(geometries.arm, materials.uniform, nearPlacements.length);
  const detailedArmRight = new THREE.InstancedMesh(geometries.arm, materials.uniform, nearPlacements.length);
  const farBody = new THREE.InstancedMesh(geometries.farBody, materials.farBody, farPlacements.length);
  const crowdMeshes = [detailedTorso, detailedHead, detailedArmLeft, detailedArmRight, farBody];

  for (const mesh of crowdMeshes) {
    mesh.name = `crowd-${mesh.geometry.name || 'instances'}`;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.userData.crowdPreview = true;
    group.add(mesh);
  }

  applyDetailedInstances(
    nearPlacements,
    detailedTorso,
    detailedHead,
    detailedArmLeft,
    detailedArmRight,
    options.accentColors,
  );
  applyFarInstances(farPlacements, farBody, options.accentColors);

  const ownedGeometries = [
    geometries.torso,
    geometries.head,
    geometries.arm,
    geometries.farBody,
  ];
  const ownedMaterials = [materials.uniform, materials.skin, materials.farBody];

  return {
    detailedArmLeft,
    detailedArmRight,
    detailedHead,
    detailedTorso,
    farBody,
    farPlacements,
    geometries: ownedGeometries,
    group,
    materials: ownedMaterials,
    nearPlacements,
    snapshotBase: {
      actualSpectatorCount: placements.length,
      crowdDrawCalls: countCrowdDrawCalls(group),
      crowdTriangles: countCrowdTriangles(group),
      estimatedInstanceBufferBytes: estimateInstanceBufferBytes(nearPlacements.length, farPlacements.length),
      farInstanceCount: farPlacements.length,
      geometryCount: ownedGeometries.length,
      materialCount: ownedMaterials.length,
      nearInstanceCount: nearPlacements.length,
      textureCount: 0,
    },
  };
}

export function applyCrowdAccentColors(
  resources: CrowdResources,
  accentColors: readonly number[] = [],
): void {
  applyDetailedInstanceColors(
    resources.nearPlacements,
    resources.detailedTorso,
    resources.detailedHead,
    resources.detailedArmLeft,
    resources.detailedArmRight,
    accentColors,
  );
  applyFarInstanceColors(resources.farPlacements, resources.farBody, accentColors);
}

function createSharedCrowdGeometries(): {
  arm: THREE.BufferGeometry;
  farBody: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  torso: THREE.BufferGeometry;
} {
  const torso = new THREE.CylinderGeometry(0.2, 0.26, CROWD_PREVIEW_CONFIG.spectator.torsoHeight, 5, 1);
  torso.name = 'spectator-torso';
  const head = new THREE.IcosahedronGeometry(CROWD_PREVIEW_CONFIG.spectator.headRadius, 0);
  head.name = 'spectator-head';
  const arm = new THREE.CylinderGeometry(0.045, 0.055, CROWD_PREVIEW_CONFIG.spectator.armLength, 5, 1);
  arm.name = 'spectator-arm';
  const farBody = new THREE.BoxGeometry(
    CROWD_PREVIEW_CONFIG.spectator.farWidth,
    CROWD_PREVIEW_CONFIG.spectator.farHeight,
    0.28,
  );
  farBody.name = 'spectator-far-body';

  return { arm, farBody, head, torso };
}

function createSharedCrowdMaterials(): {
  farBody: THREE.Material;
  skin: THREE.Material;
  uniform: THREE.Material;
} {
  return {
    farBody: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
    skin: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
    uniform: new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
  };
}

export function applyDetailedInstances(
  placements: readonly CrowdPreviewPlacement[],
  torsoMesh: THREE.InstancedMesh,
  headMesh: THREE.InstancedMesh,
  leftArmMesh: THREE.InstancedMesh,
  rightArmMesh: THREE.InstancedMesh,
  accentColors: readonly number[] = [],
): void {
  const matrix = new THREE.Matrix4();

  placements.forEach((placement, index) => {
    setPartMatrix(matrix, placement, 0, 0.48, 0, 0, placement.scale, 1);
    torsoMesh.setMatrixAt(index, matrix);

    setPartMatrix(matrix, placement, 0, 0.87, 0, 0, placement.scale, 1);
    headMesh.setMatrixAt(index, matrix);

    setPartMatrix(matrix, placement, -0.23, 0.52, 0, 0.58, placement.scale, 0.68);
    leftArmMesh.setMatrixAt(index, matrix);

    setPartMatrix(matrix, placement, 0.23, 0.52, 0, -0.58, placement.scale, 0.68);
    rightArmMesh.setMatrixAt(index, matrix);
  });

  applyDetailedInstanceColors(
    placements,
    torsoMesh,
    headMesh,
    leftArmMesh,
    rightArmMesh,
    accentColors,
  );
}

export function applyFarInstances(
  placements: readonly CrowdPreviewPlacement[],
  farBodyMesh: THREE.InstancedMesh,
  accentColors: readonly number[] = [],
): void {
  const matrix = new THREE.Matrix4();

  placements.forEach((placement, index) => {
    setPartMatrix(matrix, placement, 0, 0.45, 0, 0, placement.scale, 1);
    farBodyMesh.setMatrixAt(index, matrix);
  });

  applyFarInstanceColors(placements, farBodyMesh, accentColors);
}

export function setPartMatrix(
  matrix: THREE.Matrix4,
  placement: CrowdPreviewPlacement,
  localX: number,
  localY: number,
  localZ: number,
  localRotationZ: number,
  scale: number,
  partScale: number,
): void {
  const localOffset = new THREE.Vector3(localX * scale, localY * scale, localZ * scale);
  const worldOffset = localOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), placement.facingRadians);
  const position = new THREE.Vector3(
    placement.x + worldOffset.x,
    placement.y + worldOffset.y,
    placement.z + worldOffset.z,
  );
  const rotation = new THREE.Euler(0, placement.facingRadians, localRotationZ);
  const quaternion = new THREE.Quaternion().setFromEuler(rotation);
  const scaleVector = new THREE.Vector3(scale * partScale, scale * partScale, scale * partScale);

  matrix.compose(position, quaternion, scaleVector);
}

export function markInstanceAttributesDirty(...meshes: THREE.InstancedMesh[]): void {
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }
}

function applyDetailedInstanceColors(
  placements: readonly CrowdPreviewPlacement[],
  torsoMesh: THREE.InstancedMesh,
  headMesh: THREE.InstancedMesh,
  leftArmMesh: THREE.InstancedMesh,
  rightArmMesh: THREE.InstancedMesh,
  accentColors: readonly number[],
): void {
  const color = new THREE.Color();

  placements.forEach((placement, index) => {
    const uniformColor = resolveUniformColor(placement.colorSeed, accentColors);
    const skinColor = resolveSkinColor(placement.colorSeed);
    torsoMesh.setColorAt(index, color.setHex(uniformColor));
    headMesh.setColorAt(index, color.setHex(skinColor));
    leftArmMesh.setColorAt(index, color.setHex(uniformColor));
    rightArmMesh.setColorAt(index, color.setHex(uniformColor));
  });

  markInstanceAttributesDirty(torsoMesh, headMesh, leftArmMesh, rightArmMesh);
}

function applyFarInstanceColors(
  placements: readonly CrowdPreviewPlacement[],
  farBodyMesh: THREE.InstancedMesh,
  accentColors: readonly number[],
): void {
  const color = new THREE.Color();

  placements.forEach((placement, index) => {
    farBodyMesh.setColorAt(
      index,
      color.setHex(resolveUniformColor(placement.colorSeed, accentColors)),
    );
  });

  markInstanceAttributesDirty(farBodyMesh);
}

export function resolveUniformColor(seed: number, accentColors: readonly number[] = []): number {
  if (accentColors.length > 0 && seed % 4 !== 0) {
    return accentColors[Math.floor(seed / 3) % accentColors.length] ?? accentColors[0] ?? 0xffffff;
  }

  const colors = [0x354f7d, 0x7d3f35, 0x436946, 0x6e5c38, 0x4a4f57, 0x7a7341];
  return colors[seed % colors.length];
}

export function resolveSkinColor(seed: number): number {
  const colors = [0xf1c7a1, 0xd8a176, 0xb97952, 0x8f563b, 0x6b3d2e, 0x4a2b22];
  return colors[Math.floor(seed / 7) % colors.length];
}
