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
  SidelineCoachPlacement,
  SidelinePlayerPlacement,
  SidelinePoseId,
  SidelineReactionState,
  SidelineVisualMetrics,
} from './SidelineTeamTypes';

interface SidelineCoachMeshes {
  arm: THREE.InstancedMesh;
  cap: THREE.InstancedMesh;
  clipboard: THREE.InstancedMesh;
  head: THREE.InstancedMesh;
  headset: THREE.InstancedMesh;
  leg: THREE.InstancedMesh;
  neck: THREE.InstancedMesh;
  shoe: THREE.InstancedMesh;
  torso: THREE.InstancedMesh;
}

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
  coachMeshes: SidelineCoachMeshes;
  dispose: () => void;
  group: THREE.Group;
  metrics: SidelineVisualMetrics;
  meshes: SidelineVisualMeshes;
}

export interface SidelineVisualResourceOptions {
  coachPlacements?: readonly SidelineCoachPlacement[];
  reactionState?: SidelineReactionState;
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

const COACH_DIMENSIONS = {
  armCenterY: 0.86,
  capCenterY: 1.59,
  clipboardCenterY: 0.88,
  headCenterY: 1.43,
  headsetCenterY: 1.45,
  legCenterY: 0.4,
  neckCenterY: 1.24,
  shoeCenterY: 0.045,
  torsoCenterY: 0.8,
} as const;

const COACH_VISUAL_CONFIG = {
  armLength: 0.54,
  armRadius: 0.07,
  capHeight: 0.08,
  capRadius: 0.15,
  clipboardDepth: 0.035,
  clipboardHeight: 0.36,
  clipboardWidth: 0.25,
  headsetDepth: 0.055,
  headsetHeight: 0.18,
  headsetWidth: 0.06,
  legLength: 0.58,
  legRadius: 0.085,
  shoeDepth: 0.28,
  shoeHeight: 0.08,
  shoeWidth: 0.16,
  torsoBottomRadius: 0.2,
  torsoHeight: 0.62,
  torsoTopRadius: 0.25,
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

type SidelineActorPlacement = SidelineCoachPlacement | SidelinePlayerPlacement;

export function createSidelineVisualResources(
  placements: readonly SidelinePlayerPlacement[],
  theme: TeamPresentationTheme,
  options: SidelineVisualResourceOptions = {},
): SidelineVisualResources {
  const group = new THREE.Group();
  group.name = 'sideline-team-presentation-root';
  group.userData.sidelinePresentation = true;

  const geometries = createGeometries();
  const coachGeometries = createCoachGeometries();
  const materials = createMaterials();
  const playerCount = placements.length;
  const limbCount = playerCount * 2;
  const coachPlacements = options.coachPlacements ?? [];
  const coachCount = coachPlacements.length;
  const coachLimbCount = coachCount * 2;

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
  const coachMeshes: SidelineCoachMeshes = {
    arm: createMesh('sideline-coach-arm-instances', coachGeometries.arm, materials.uniform, coachLimbCount),
    cap: createMesh('sideline-coach-cap-instances', coachGeometries.cap, materials.uniform, coachCount),
    clipboard: createMesh(
      'sideline-coach-clipboard-instances',
      coachGeometries.clipboard,
      materials.uniform,
      coachCount,
    ),
    head: createMesh('sideline-coach-head-instances', geometries.head, materials.skin, coachCount),
    headset: createMesh(
      'sideline-coach-headset-instances',
      coachGeometries.headset,
      materials.uniform,
      coachCount,
    ),
    leg: createMesh('sideline-coach-leg-instances', coachGeometries.leg, materials.uniform, coachLimbCount),
    neck: createMesh('sideline-coach-neck-instances', geometries.neck, materials.skin, coachCount),
    shoe: createMesh('sideline-coach-shoe-instances', coachGeometries.shoe, materials.uniform, coachLimbCount),
    torso: createMesh('sideline-coach-torso-instances', coachGeometries.torso, materials.uniform, coachCount),
  };

  for (const mesh of [...Object.values(meshes), ...Object.values(coachMeshes)]) {
    mesh.userData.sidelinePresentation = true;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    group.add(mesh);
  }

  syncSidelineVisualResources(
    { coachMeshes, meshes },
    placements,
    theme,
    {
      coachPlacements,
      reactionState: options.reactionState,
    },
  );

  const geometryList = [...Object.values(geometries), ...Object.values(coachGeometries)];
  const materialList = Object.values(materials);
  const instancedMeshes = [...Object.values(meshes), ...Object.values(coachMeshes)];
  const activeInstancedMeshes = instancedMeshes.filter((mesh) => mesh.visible);
  const metrics = createSidelineVisualMetrics(
    group,
    activeInstancedMeshes,
    activeInstancedMeshes.map((mesh) => mesh.geometry),
    materialList,
  );

  return {
    coachMeshes,
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
  resources: { coachMeshes?: SidelineCoachMeshes; meshes: SidelineVisualMeshes },
  placements: readonly SidelinePlayerPlacement[],
  theme: TeamPresentationTheme,
  options: SidelineVisualResourceOptions = {},
): void {
  placements.forEach((placement, index) => {
    const pose = resolvePose(resolveReactivePose(placement.pose, index, options.reactionState ?? 'idle'));

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

  if (resources.coachMeshes) {
    syncCoachVisualResources(resources.coachMeshes, options.coachPlacements ?? [], theme);
    markMatricesDirty(Object.values(resources.coachMeshes));
  }
  markMatricesDirty(Object.values(resources.meshes));
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
    coachCount: number;
    coachStates: readonly {
      id: string;
      state: string;
      teamSide: string;
    }[];
    coachesEnabled: boolean;
    lastReactionEventId: string | null;
    reactionState: string;
    sidelinePlayerCount: number;
    sidelinePlayersEnabled: boolean;
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
    `enabled ${snapshot.enabled ? 'yes' : 'no'} density ${snapshot.density} reserves ${snapshot.sidelinePlayersEnabled ? 'on' : 'off'} coaches ${snapshot.coachesEnabled ? 'on' : 'off'}`,
    `sideline ${snapshot.sidelinePlayerCount} coaches ${snapshot.coachCount} tunnel ${snapshot.tunnelPlayerCount} tableau ${snapshot.tunnelTableauEnabled ? 'on' : 'off'}`,
    `reaction ${snapshot.reactionState} event ${snapshot.lastReactionEventId ?? 'none'}`,
    ...snapshot.coachStates.map((coach) => `${coach.id} ${coach.teamSide} ${coach.state}`),
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

function createCoachGeometries() {
  return {
    arm: new THREE.CylinderGeometry(
      COACH_VISUAL_CONFIG.armRadius * 0.8,
      COACH_VISUAL_CONFIG.armRadius,
      COACH_VISUAL_CONFIG.armLength,
      5,
      1,
      false,
    ),
    cap: new THREE.CylinderGeometry(
      COACH_VISUAL_CONFIG.capRadius,
      COACH_VISUAL_CONFIG.capRadius * 0.88,
      COACH_VISUAL_CONFIG.capHeight,
      8,
      1,
      false,
    ),
    clipboard: new THREE.BoxGeometry(
      COACH_VISUAL_CONFIG.clipboardWidth,
      COACH_VISUAL_CONFIG.clipboardHeight,
      COACH_VISUAL_CONFIG.clipboardDepth,
    ),
    headset: new THREE.BoxGeometry(
      COACH_VISUAL_CONFIG.headsetWidth,
      COACH_VISUAL_CONFIG.headsetHeight,
      COACH_VISUAL_CONFIG.headsetDepth,
    ),
    leg: new THREE.CylinderGeometry(
      COACH_VISUAL_CONFIG.legRadius * 0.82,
      COACH_VISUAL_CONFIG.legRadius,
      COACH_VISUAL_CONFIG.legLength,
      5,
      1,
      false,
    ),
    shoe: new THREE.BoxGeometry(
      COACH_VISUAL_CONFIG.shoeWidth,
      COACH_VISUAL_CONFIG.shoeHeight,
      COACH_VISUAL_CONFIG.shoeDepth,
    ),
    torso: new THREE.CylinderGeometry(
      COACH_VISUAL_CONFIG.torsoTopRadius,
      COACH_VISUAL_CONFIG.torsoBottomRadius,
      COACH_VISUAL_CONFIG.torsoHeight,
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
  mesh.visible = count > 0;
  return mesh;
}

function setPartMatrix(
  mesh: THREE.InstancedMesh,
  index: number,
  placement: SidelineActorPlacement,
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
  placement: SidelineActorPlacement,
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

function syncCoachVisualResources(
  meshes: SidelineCoachMeshes,
  placements: readonly SidelineCoachPlacement[],
  theme: TeamPresentationTheme,
): void {
  placements.forEach((placement, index) => {
    const pose = resolveCoachPose(placement.state);

    setPartMatrix(meshes.torso, index, placement, {
      rotationX: pose.torsoLean,
      y: COACH_DIMENSIONS.torsoCenterY,
    });
    setPartMatrix(meshes.neck, index, placement, {
      y: COACH_DIMENSIONS.neckCenterY,
    });
    setPartMatrix(meshes.head, index, placement, {
      y: COACH_DIMENSIONS.headCenterY,
    });
    setPartMatrix(meshes.cap, index, placement, {
      y: COACH_DIMENSIONS.capCenterY,
      z: -0.015,
    });
    setPartMatrix(meshes.headset, index, placement, {
      x: -0.14,
      y: COACH_DIMENSIONS.headsetCenterY,
      z: 0.025,
    });
    setPartMatrix(meshes.clipboard, index, placement, {
      rotationX: -0.18,
      rotationZ: pose.clipboardRotationZ,
      x: 0.34,
      y: COACH_DIMENSIONS.clipboardCenterY,
      z: 0.18,
    });
    setPartMatrix(meshes.arm, index * 2, placement, {
      rotationZ: pose.leftArmRotationZ,
      x: -0.27,
      y: COACH_DIMENSIONS.armCenterY,
      z: pose.armForwardOffset,
    });
    setPartMatrix(meshes.arm, index * 2 + 1, placement, {
      rotationZ: pose.rightArmRotationZ,
      x: 0.27,
      y: COACH_DIMENSIONS.armCenterY,
      z: pose.armForwardOffset,
    });
    setPartMatrix(meshes.leg, index * 2, placement, {
      x: -0.12,
      y: COACH_DIMENSIONS.legCenterY,
    });
    setPartMatrix(meshes.leg, index * 2 + 1, placement, {
      x: 0.12,
      y: COACH_DIMENSIONS.legCenterY,
    });
    setPartMatrix(meshes.shoe, index * 2, placement, {
      x: -0.12,
      y: COACH_DIMENSIONS.shoeCenterY,
      z: 0.04,
    });
    setPartMatrix(meshes.shoe, index * 2 + 1, placement, {
      x: 0.12,
      y: COACH_DIMENSIONS.shoeCenterY,
      z: 0.04,
    });

    applyCoachInstanceColors(meshes, placement, index, theme);
  });
}

function applyCoachInstanceColors(
  meshes: SidelineCoachMeshes,
  placement: SidelineCoachPlacement,
  index: number,
  theme: TeamPresentationTheme,
): void {
  const palette = theme.uniforms[placement.team];
  const skin = resolvePlayerAppearance(placement.appearanceId).skinColor;

  meshes.torso.setColorAt(index, scratch.color.setHex(getUniformColorNumber(palette.jersey)));
  meshes.cap.setColorAt(index, scratch.color.setHex(getUniformColorNumber(palette.helmetShell)));
  meshes.clipboard.setColorAt(index, scratch.color.setHex(0xf2eed9));
  meshes.headset.setColorAt(index, scratch.color.setHex(0x141817));
  meshes.head.setColorAt(index, scratch.color.setHex(skin));
  meshes.neck.setColorAt(index, scratch.color.setHex(skin));
  meshes.arm.setColorAt(index * 2, scratch.color.setHex(skin));
  meshes.arm.setColorAt(index * 2 + 1, scratch.color.setHex(skin));
  meshes.leg.setColorAt(index * 2, scratch.color.setHex(getUniformColorNumber(palette.pants)));
  meshes.leg.setColorAt(index * 2 + 1, scratch.color.setHex(getUniformColorNumber(palette.pants)));
  meshes.shoe.setColorAt(index * 2, scratch.color.setHex(getUniformColorNumber(palette.shoe)));
  meshes.shoe.setColorAt(index * 2 + 1, scratch.color.setHex(getUniformColorNumber(palette.shoe)));
}

function markMatricesDirty(meshes: readonly THREE.InstancedMesh[]): void {
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }
}

function resolveReactivePose(
  basePose: SidelinePoseId,
  index: number,
  reactionState: SidelineReactionState,
): SidelinePoseId {
  if (reactionState === 'touchdown') {
    return index % 3 === 0 ? 'celebrating' : 'handsOnHips';
  }

  if (reactionState === 'firstDown') {
    return index % 4 === 0 ? 'celebrating' : basePose;
  }

  if (reactionState === 'disappointed') {
    return index % 2 === 0 ? 'disappointed' : 'armsLow';
  }

  return basePose;
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
  if (pose === 'celebrating') {
    return {
      armForwardOffset: 0.02,
      leftArmRotationZ: -1.55,
      leftLegRotationZ: 0.08,
      rightArmRotationZ: 1.55,
      rightLegRotationZ: -0.08,
      torsoLean: -0.04,
      verticalOffset: 0.02,
    };
  }
  if (pose === 'disappointed') {
    return {
      armForwardOffset: -0.02,
      leftArmRotationZ: -0.04,
      leftLegRotationZ: -0.04,
      rightArmRotationZ: 0.04,
      rightLegRotationZ: 0.04,
      torsoLean: 0.14,
      verticalOffset: -0.03,
    };
  }
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

function resolveCoachPose(state: SidelineCoachPlacement['state']): {
  armForwardOffset: number;
  clipboardRotationZ: number;
  leftArmRotationZ: number;
  rightArmRotationZ: number;
  torsoLean: number;
} {
  if (state === 'touchdownCelebration') {
    return {
      armForwardOffset: 0.02,
      clipboardRotationZ: 0.2,
      leftArmRotationZ: -1.45,
      rightArmRotationZ: 1.3,
      torsoLean: -0.06,
    };
  }

  if (state === 'firstDownApproval') {
    return {
      armForwardOffset: 0.04,
      clipboardRotationZ: -0.1,
      leftArmRotationZ: -0.55,
      rightArmRotationZ: 0.9,
      torsoLean: -0.02,
    };
  }

  if (state === 'disappointedResult') {
    return {
      armForwardOffset: -0.03,
      clipboardRotationZ: 0.05,
      leftArmRotationZ: -0.05,
      rightArmRotationZ: 0.18,
      torsoLean: 0.12,
    };
  }

  if (state === 'watchingPlay') {
    return {
      armForwardOffset: 0.04,
      clipboardRotationZ: -0.16,
      leftArmRotationZ: -0.22,
      rightArmRotationZ: 0.28,
      torsoLean: -0.06,
    };
  }

  return {
    armForwardOffset: 0,
    clipboardRotationZ: -0.08,
    leftArmRotationZ: -0.12,
    rightArmRotationZ: 0.18,
    torsoLean: 0,
  };
}
