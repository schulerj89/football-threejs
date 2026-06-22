import * as THREE from 'three';
import { resolvePlayerAppearance } from '../../playerAppearance';
import {
  getUniformColorNumber,
  type TeamPresentationTheme,
} from '../../teams/TeamThemeApplier';
import {
  createSidelineVisualMetrics,
} from './SidelineMetrics';
import type {
  SidelinePlayerPlacement,
  SidelinePoseId,
  SidelineVisualMetrics,
} from './SidelineTeamTypes';

interface SidelineVisualMeshes {
  arm: THREE.InstancedMesh;
  faceguard: THREE.InstancedMesh;
  head: THREE.InstancedMesh;
  helmet: THREE.InstancedMesh;
  leg: THREE.InstancedMesh;
  neck: THREE.InstancedMesh;
  shoe: THREE.InstancedMesh;
  shoulder: THREE.InstancedMesh;
  torso: THREE.InstancedMesh;
}

export interface SidelineVisualResources {
  dispose: () => void;
  group: THREE.Group;
  metrics: SidelineVisualMetrics;
  meshes: SidelineVisualMeshes;
}

const SIDELINE_VISUAL_CONFIG = {
  armLength: 0.52,
  armRadius: 0.075,
  faceguardDepth: 0.035,
  faceguardHeight: 0.18,
  faceguardWidth: 0.26,
  footDepth: 0.28,
  footHeight: 0.09,
  footWidth: 0.16,
  headRadius: 0.13,
  helmetRadius: 0.18,
  legLength: 0.55,
  legRadius: 0.09,
  neckHeight: 0.1,
  neckRadius: 0.055,
  shoulderDepth: 0.38,
  shoulderHeight: 0.16,
  shoulderWidth: 0.82,
  torsoBottomRadius: 0.21,
  torsoHeight: 0.58,
  torsoTopRadius: 0.27,
} as const;

const DIMENSIONS = {
  armCenterY: 0.88,
  faceguardCenterY: 1.54,
  headCenterY: 1.42,
  helmetCenterY: 1.46,
  legCenterY: 0.39,
  neckCenterY: 1.23,
  shoeCenterY: 0.045,
  shoulderCenterY: 1.08,
  torsoCenterY: 0.78,
} as const;

const scratch = {
  baseMatrix: new THREE.Matrix4(),
  color: new THREE.Color(),
  localMatrix: new THREE.Matrix4(),
  localQuaternion: new THREE.Quaternion(),
  matrix: new THREE.Matrix4(),
  quaternion: new THREE.Quaternion(),
  scale: new THREE.Vector3(1, 1, 1),
  vector: new THREE.Vector3(),
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const scratchEuler = new THREE.Euler();

export function createSidelineVisualResources(
  placements: readonly SidelinePlayerPlacement[],
  theme: TeamPresentationTheme,
): SidelineVisualResources {
  const group = new THREE.Group();
  group.name = 'sideline-team-presentation-root';
  group.userData.sidelinePresentation = true;

  const geometries = createGeometries();
  const materials = createMaterials();
  const playerCount = placements.length;
  const limbCount = playerCount * 2;

  const meshes: SidelineVisualMeshes = {
    arm: createMesh('sideline-player-arm-instances', geometries.arm, materials.skin, limbCount),
    faceguard: createMesh(
      'sideline-player-faceguard-instances',
      geometries.faceguard,
      materials.uniform,
      playerCount,
    ),
    head: createMesh('sideline-player-head-instances', geometries.head, materials.skin, playerCount),
    helmet: createMesh(
      'sideline-player-helmet-instances',
      geometries.helmet,
      materials.uniform,
      playerCount,
    ),
    leg: createMesh('sideline-player-leg-instances', geometries.leg, materials.uniform, limbCount),
    neck: createMesh('sideline-player-neck-instances', geometries.neck, materials.skin, playerCount),
    shoe: createMesh('sideline-player-shoe-instances', geometries.shoe, materials.uniform, limbCount),
    shoulder: createMesh(
      'sideline-player-shoulder-instances',
      geometries.shoulder,
      materials.uniform,
      playerCount,
    ),
    torso: createMesh(
      'sideline-player-torso-instances',
      geometries.torso,
      materials.uniform,
      playerCount,
    ),
  };

  for (const mesh of Object.values(meshes)) {
    mesh.userData.sidelinePresentation = true;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    group.add(mesh);
  }

  syncSidelineVisualResources({ meshes }, placements, theme);

  const geometryList = Object.values(geometries);
  const materialList = Object.values(materials);
  const metrics = createSidelineVisualMetrics(group, Object.values(meshes), geometryList, materialList);

  return {
    dispose: () => {
      group.clear();
      for (const geometry of geometryList) {
        geometry.dispose();
      }
      for (const material of materialList) {
        material.dispose();
      }
    },
    group,
    metrics,
    meshes,
  };
}

export function syncSidelineVisualResources(
  resources: Pick<SidelineVisualResources, 'meshes'>,
  placements: readonly SidelinePlayerPlacement[],
  theme: TeamPresentationTheme,
): void {
  placements.forEach((placement, index) => {
    const pose = resolvePose(placement.pose);

    setPartMatrix(resources.meshes.torso, index, placement, {
      rotationX: pose.torsoLean,
      y: DIMENSIONS.torsoCenterY + pose.verticalOffset,
    });
    setPartMatrix(resources.meshes.shoulder, index, placement, {
      rotationX: pose.torsoLean,
      y: DIMENSIONS.shoulderCenterY + pose.verticalOffset,
    });
    setPartMatrix(resources.meshes.neck, index, placement, {
      y: DIMENSIONS.neckCenterY + pose.verticalOffset,
    });
    setPartMatrix(resources.meshes.head, index, placement, {
      y: DIMENSIONS.headCenterY + pose.verticalOffset,
    });
    setPartMatrix(resources.meshes.helmet, index, placement, {
      y: DIMENSIONS.helmetCenterY + pose.verticalOffset,
    });
    setPartMatrix(resources.meshes.faceguard, index, placement, {
      y: DIMENSIONS.faceguardCenterY + pose.verticalOffset,
      z: SIDELINE_VISUAL_CONFIG.helmetRadius * 0.72,
    });

    setPartMatrix(resources.meshes.arm, index * 2, placement, {
      rotationZ: pose.leftArmRotationZ,
      x: -SIDELINE_VISUAL_CONFIG.shoulderWidth / 2,
      y: DIMENSIONS.armCenterY + pose.verticalOffset,
      z: pose.armForwardOffset,
    });
    setPartMatrix(resources.meshes.arm, index * 2 + 1, placement, {
      rotationZ: pose.rightArmRotationZ,
      x: SIDELINE_VISUAL_CONFIG.shoulderWidth / 2,
      y: DIMENSIONS.armCenterY + pose.verticalOffset,
      z: pose.armForwardOffset,
    });
    setPartMatrix(resources.meshes.leg, index * 2, placement, {
      rotationZ: pose.leftLegRotationZ,
      x: -0.13,
      y: DIMENSIONS.legCenterY,
    });
    setPartMatrix(resources.meshes.leg, index * 2 + 1, placement, {
      rotationZ: pose.rightLegRotationZ,
      x: 0.13,
      y: DIMENSIONS.legCenterY,
    });
    setPartMatrix(resources.meshes.shoe, index * 2, placement, {
      x: -0.13,
      y: DIMENSIONS.shoeCenterY,
      z: 0.04,
    });
    setPartMatrix(resources.meshes.shoe, index * 2 + 1, placement, {
      x: 0.13,
      y: DIMENSIONS.shoeCenterY,
      z: 0.04,
    });

    applyInstanceColors(resources.meshes, placement, index, theme);
  });

  markMatricesDirty(resources.meshes);
}

export function createSidelineDebugOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'sideline-debug-overlay';
  document.body.append(element);
  return element;
}

export function syncSidelineDebugOverlay(
  element: HTMLElement,
  snapshot: {
    density: string;
    drawCalls: number;
    enabled: boolean;
    geometryCount: number;
    instanceBufferBytes: number;
    materialCount: number;
    sidelinePlayerCount: number;
    triangleCount: number;
    tunnelPlayerCount: number;
    tunnelTableauEnabled: boolean;
    updateFrequencyHz: number;
    zones: readonly {
      bounds: { maxX: number; maxZ: number; minX: number; minZ: number };
      id: string;
    }[];
  },
): void {
  element.textContent = [
    'SIDELINE TEAMS',
    `enabled ${snapshot.enabled ? 'yes' : 'no'} density ${snapshot.density}`,
    `sideline ${snapshot.sidelinePlayerCount} tunnel ${snapshot.tunnelPlayerCount} tableau ${snapshot.tunnelTableauEnabled ? 'on' : 'off'}`,
    `calls ${snapshot.drawCalls} tris ${snapshot.triangleCount}`,
    `geoms ${snapshot.geometryCount} mats ${snapshot.materialCount} instanceBytes ${snapshot.instanceBufferBytes}`,
    `updates ${snapshot.updateFrequencyHz}hz`,
    ...snapshot.zones.map((zone) =>
      `${zone.id} x ${zone.bounds.minX.toFixed(1)}..${zone.bounds.maxX.toFixed(1)} z ${zone.bounds.minZ.toFixed(1)}..${zone.bounds.maxZ.toFixed(1)}`),
  ].join('\n');
}

function createGeometries() {
  return {
    arm: new THREE.CylinderGeometry(
      SIDELINE_VISUAL_CONFIG.armRadius * 0.8,
      SIDELINE_VISUAL_CONFIG.armRadius,
      SIDELINE_VISUAL_CONFIG.armLength,
      5,
      1,
      false,
    ),
    faceguard: new THREE.BoxGeometry(
      SIDELINE_VISUAL_CONFIG.faceguardWidth,
      SIDELINE_VISUAL_CONFIG.faceguardHeight,
      SIDELINE_VISUAL_CONFIG.faceguardDepth,
    ),
    head: new THREE.IcosahedronGeometry(SIDELINE_VISUAL_CONFIG.headRadius, 0),
    helmet: new THREE.IcosahedronGeometry(SIDELINE_VISUAL_CONFIG.helmetRadius, 1),
    leg: new THREE.CylinderGeometry(
      SIDELINE_VISUAL_CONFIG.legRadius * 0.82,
      SIDELINE_VISUAL_CONFIG.legRadius,
      SIDELINE_VISUAL_CONFIG.legLength,
      5,
      1,
      false,
    ),
    neck: new THREE.CylinderGeometry(
      SIDELINE_VISUAL_CONFIG.neckRadius,
      SIDELINE_VISUAL_CONFIG.neckRadius,
      SIDELINE_VISUAL_CONFIG.neckHeight,
      6,
      1,
      false,
    ),
    shoe: new THREE.BoxGeometry(
      SIDELINE_VISUAL_CONFIG.footWidth,
      SIDELINE_VISUAL_CONFIG.footHeight,
      SIDELINE_VISUAL_CONFIG.footDepth,
    ),
    shoulder: new THREE.BoxGeometry(
      SIDELINE_VISUAL_CONFIG.shoulderWidth,
      SIDELINE_VISUAL_CONFIG.shoulderHeight,
      SIDELINE_VISUAL_CONFIG.shoulderDepth,
    ),
    torso: new THREE.CylinderGeometry(
      SIDELINE_VISUAL_CONFIG.torsoTopRadius,
      SIDELINE_VISUAL_CONFIG.torsoBottomRadius,
      SIDELINE_VISUAL_CONFIG.torsoHeight,
      6,
      1,
      false,
    ),
  } as const;
}

function createMaterials() {
  return {
    skin: new THREE.MeshLambertMaterial({
      color: 0xffffff,
      flatShading: true,
      vertexColors: true,
    }),
    uniform: new THREE.MeshLambertMaterial({
      color: 0xffffff,
      flatShading: true,
      vertexColors: true,
    }),
  } as const;
}

function createMesh(
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  count: number,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = name;
  mesh.frustumCulled = false;
  return mesh;
}

function setPartMatrix(
  mesh: THREE.InstancedMesh,
  index: number,
  placement: SidelinePlayerPlacement,
  local: {
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
    x?: number;
    y: number;
    z?: number;
  },
): void {
  composeMatrix(scratch.matrix, placement, local);
  mesh.setMatrixAt(index, scratch.matrix);
}

function composeMatrix(
  matrix: THREE.Matrix4,
  placement: SidelinePlayerPlacement,
  local: {
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
    x?: number;
    y: number;
    z?: number;
  },
): void {
  scratch.quaternion.setFromAxisAngle(Y_AXIS, placement.facingRadians);
  const scale = placement.scale;
  scratch.baseMatrix.compose(
    scratch.vector.set(placement.position.x, placement.position.y, placement.position.z),
    scratch.quaternion,
    scratch.scale.set(scale, scale, scale),
  );
  scratch.localQuaternion.setFromEuler(
    scratchEuler.set(
      local.rotationX ?? 0,
      local.rotationY ?? 0,
      local.rotationZ ?? 0,
    ),
  );
  scratch.localMatrix.compose(
    scratch.vector.set(local.x ?? 0, local.y, local.z ?? 0),
    scratch.localQuaternion,
    scratch.scale.set(1, 1, 1),
  );
  matrix.multiplyMatrices(scratch.baseMatrix, scratch.localMatrix);
}

function applyInstanceColors(
  meshes: SidelineVisualMeshes,
  placement: SidelinePlayerPlacement,
  index: number,
  theme: TeamPresentationTheme,
): void {
  const palette = theme.uniforms[placement.team];
  const skin = resolvePlayerAppearance(placement.appearanceId).skinColor;

  meshes.torso.setColorAt(index, scratch.color.setHex(getUniformColorNumber(palette.jersey)));
  meshes.shoulder.setColorAt(index, scratch.color.setHex(getUniformColorNumber(palette.shoulder)));
  meshes.helmet.setColorAt(index, scratch.color.setHex(getUniformColorNumber(palette.helmetShell)));
  meshes.faceguard.setColorAt(index, scratch.color.setHex(getUniformColorNumber(palette.faceguard)));
  meshes.head.setColorAt(index, scratch.color.setHex(skin));
  meshes.neck.setColorAt(index, scratch.color.setHex(skin));

  meshes.arm.setColorAt(index * 2, scratch.color.setHex(skin));
  meshes.arm.setColorAt(index * 2 + 1, scratch.color.setHex(skin));
  meshes.leg.setColorAt(index * 2, scratch.color.setHex(getUniformColorNumber(palette.pants)));
  meshes.leg.setColorAt(index * 2 + 1, scratch.color.setHex(getUniformColorNumber(palette.pants)));
  meshes.shoe.setColorAt(index * 2, scratch.color.setHex(getUniformColorNumber(palette.shoe)));
  meshes.shoe.setColorAt(index * 2 + 1, scratch.color.setHex(getUniformColorNumber(palette.shoe)));
}

function markMatricesDirty(meshes: SidelineVisualMeshes): void {
  for (const mesh of Object.values(meshes)) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }
}

function resolvePose(pose: SidelinePoseId): {
  armForwardOffset: number;
  leftArmRotationZ: number;
  leftLegRotationZ: number;
  rightArmRotationZ: number;
  rightLegRotationZ: number;
  torsoLean: number;
  verticalOffset: number;
} {
  if (pose === 'handsOnHips') {
    return {
      armForwardOffset: 0.03,
      leftArmRotationZ: -0.85,
      leftLegRotationZ: 0.05,
      rightArmRotationZ: 0.85,
      rightLegRotationZ: -0.05,
      torsoLean: 0,
      verticalOffset: 0,
    };
  }
  if (pose === 'crouched') {
    return {
      armForwardOffset: 0.08,
      leftArmRotationZ: -0.35,
      leftLegRotationZ: 0.16,
      rightArmRotationZ: 0.35,
      rightLegRotationZ: -0.16,
      torsoLean: 0.1,
      verticalOffset: -0.08,
    };
  }
  if (pose === 'slightLean') {
    return {
      armForwardOffset: 0.04,
      leftArmRotationZ: -0.16,
      leftLegRotationZ: 0.08,
      rightArmRotationZ: 0.16,
      rightLegRotationZ: -0.08,
      torsoLean: -0.08,
      verticalOffset: 0,
    };
  }
  if (pose === 'armsLow') {
    return {
      armForwardOffset: 0,
      leftArmRotationZ: -0.28,
      leftLegRotationZ: 0.02,
      rightArmRotationZ: 0.28,
      rightLegRotationZ: -0.02,
      torsoLean: 0,
      verticalOffset: 0,
    };
  }
  return {
    armForwardOffset: 0,
    leftArmRotationZ: -0.1,
    leftLegRotationZ: 0,
    rightArmRotationZ: 0.1,
    rightLegRotationZ: 0,
    torsoLean: 0,
    verticalOffset: 0,
  };
}
