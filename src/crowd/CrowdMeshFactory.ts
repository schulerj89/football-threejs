import * as THREE from 'three';
import { CROWD_PREVIEW_CONFIG } from './CrowdConfiguration';
import { createCrowdPlacements } from './CrowdLayout';
import {
  resolveCrowdAttendanceProfile,
  type CrowdDensity,
} from './CrowdReactionModel';
import {
  countCrowdDrawCalls,
  countCrowdTriangles,
  estimateInstanceBufferBytes,
  estimateStaticCrowdBufferBytes,
} from './CrowdMetrics';
import type { CrowdPreviewPlacement, CrowdResources } from './CrowdTypes';

export interface CrowdColorOptions {
  accentColors?: readonly number[];
  crowdFullness?: CrowdResources['snapshotBase']['crowdFullness'];
  density?: CrowdDensity;
  nearCount?: number;
  reactingSpectatorLimit?: number;
}

export function createCrowdResources(
  requestedCount: number,
  options: CrowdColorOptions = {},
): CrowdResources {
  const attendanceProfile = resolveCrowdAttendanceProfile(
    options.crowdFullness ?? 'sparse',
    options.density,
  );
  const nearCount = options.nearCount ?? attendanceProfile.activeNearSpectators;
  const reactingSpectatorLimit =
    options.reactingSpectatorLimit ?? attendanceProfile.reactingSpectatorLimit;
  const placements = createCrowdPlacements(requestedCount, { nearCount });
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
  const farMosaic = createFarMosaic(farPlacements, materials.farMosaic, options.accentColors);
  const crowdMeshes = [detailedTorso, detailedHead, detailedArmLeft, detailedArmRight];

  for (const mesh of crowdMeshes) {
    mesh.name = `crowd-${mesh.geometry.name || 'instances'}`;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.userData.crowdPreview = true;
    group.add(mesh);
  }
  farMosaic.name = 'crowd-far-seat-mosaic';
  farMosaic.userData.crowdPreview = true;
  group.add(farMosaic);

  applyDetailedInstances(
    nearPlacements,
    detailedTorso,
    detailedHead,
    detailedArmLeft,
    detailedArmRight,
    options.accentColors,
  );

  const ownedGeometries = [
    geometries.torso,
    geometries.head,
    geometries.arm,
    farMosaic.geometry,
  ];
  const ownedMaterials = [materials.uniform, materials.skin, materials.farMosaic];

  return {
    detailedArmLeft,
    detailedArmRight,
    detailedHead,
    detailedTorso,
    farMosaic,
    farPlacements,
    geometries: ownedGeometries,
    group,
    materials: ownedMaterials,
    nearPlacements,
    snapshotBase: {
      actualSpectatorCount: placements.length,
      activeNearSpectators: nearPlacements.length,
      crowdDrawCalls: countCrowdDrawCalls(group),
      crowdFullness: options.crowdFullness ?? 'sparse',
      crowdTriangles: countCrowdTriangles(group),
      estimatedInstanceBufferBytes: estimateInstanceBufferBytes(nearPlacements.length, 0),
      estimatedStaticBufferBytes: estimateStaticCrowdBufferBytes(farPlacements.length),
      farInstanceCount: 0,
      farMosaicSeatCount: farPlacements.length,
      farSeatOccupancy: farPlacements.length,
      geometryCount: ownedGeometries.length,
      materialCount: ownedMaterials.length,
      nearInstanceCount: nearPlacements.length,
      reactingSpectatorLimit,
      textureCount: 0,
      visualAttendance: placements.length,
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
  applyFarMosaicColors(resources.farPlacements, resources.farMosaic, accentColors);
}

function createSharedCrowdGeometries(): {
  arm: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  torso: THREE.BufferGeometry;
} {
  const torso = new THREE.CylinderGeometry(0.2, 0.26, CROWD_PREVIEW_CONFIG.spectator.torsoHeight, 5, 1);
  torso.name = 'spectator-torso';
  const head = new THREE.IcosahedronGeometry(CROWD_PREVIEW_CONFIG.spectator.headRadius, 0);
  head.name = 'spectator-head';
  const arm = new THREE.CylinderGeometry(0.045, 0.055, CROWD_PREVIEW_CONFIG.spectator.armLength, 5, 1);
  arm.name = 'spectator-arm';
  return { arm, head, torso };
}

function createSharedCrowdMaterials(): {
  farMosaic: THREE.PointsMaterial;
  skin: THREE.Material;
  uniform: THREE.Material;
} {
  return {
    farMosaic: new THREE.PointsMaterial({
      color: 0xffffff,
      size: Math.max(CROWD_PREVIEW_CONFIG.spectator.farWidth, CROWD_PREVIEW_CONFIG.spectator.farHeight),
      sizeAttenuation: true,
      vertexColors: true,
    }),
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

function createFarMosaic(
  placements: readonly CrowdPreviewPlacement[],
  material: THREE.PointsMaterial,
  accentColors: readonly number[] = [],
): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.name = 'spectator-far-seat-mosaic';

  const positions = new Float32Array(placements.length * 3);
  placements.forEach((placement, index) => {
    positions[index * 3] = placement.x;
    positions[index * 3 + 1] = placement.y + 0.42 * placement.scale;
    positions[index * 3 + 2] = placement.z;
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, material);
  applyFarMosaicColors(placements, points, accentColors);
  return points;
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

function applyFarMosaicColors(
  placements: readonly CrowdPreviewPlacement[],
  farMosaic: THREE.Points,
  accentColors: readonly number[],
): void {
  const colors = new Float32Array(placements.length * 3);
  const color = new THREE.Color();

  placements.forEach((placement, index) => {
    color.setHex(resolveUniformColor(placement.colorSeed, accentColors));
    const dimmer = 0.72 + ((placement.colorSeed >>> 4) % 19) / 100;
    colors[index * 3] = color.r * dimmer;
    colors[index * 3 + 1] = color.g * dimmer;
    colors[index * 3 + 2] = color.b * dimmer;
  });

  farMosaic.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  farMosaic.geometry.getAttribute('color').needsUpdate = true;
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
