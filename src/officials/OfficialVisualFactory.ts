import * as THREE from 'three';
import { resolvePlayerAppearance } from '../playerAppearance';
import { OFFICIAL_ROLE_LABELS, OFFICIAL_VISUAL_CONFIG } from './OfficialConfiguration';
import type {
  OfficialModel,
  OfficialPoseIntent,
  OfficialVisualMetrics,
} from './OfficialTypes';

interface OfficialVisualMeshes {
  arm: THREE.InstancedMesh;
  cap: THREE.InstancedMesh;
  capBrim: THREE.InstancedMesh;
  head: THREE.InstancedMesh;
  leg: THREE.InstancedMesh;
  neck: THREE.InstancedMesh;
  shoe: THREE.InstancedMesh;
  stripe: THREE.InstancedMesh;
  torso: THREE.InstancedMesh;
}

export interface OfficialVisualResources {
  dispose: () => void;
  group: THREE.Group;
  metrics: OfficialVisualMetrics;
  meshes: OfficialVisualMeshes;
}

const WHITE = 0xf5f5f0;
const BLACK = 0x111111;

export function createOfficialVisualResources(
  officials: readonly OfficialModel[],
): OfficialVisualResources {
  const group = new THREE.Group();
  group.name = 'officials-presentation-root';
  group.userData.officialsPresentation = true;

  const geometries = createGeometries();
  const materials = createMaterials();
  const officialCount = officials.length;
  const stripeCount = officialCount * OFFICIAL_VISUAL_CONFIG.stripeCount;
  const limbCount = officialCount * 2;

  const meshes: OfficialVisualMeshes = {
    arm: createMesh('official-arm-instances', geometries.arm, materials.black, limbCount),
    cap: createMesh('official-cap-instances', geometries.cap, materials.black, officialCount),
    capBrim: createMesh(
      'official-cap-brim-instances',
      geometries.capBrim,
      materials.black,
      officialCount,
    ),
    head: createMesh('official-head-instances', geometries.head, materials.skin, officialCount),
    leg: createMesh('official-leg-instances', geometries.leg, materials.black, limbCount),
    neck: createMesh('official-neck-instances', geometries.neck, materials.skin, officialCount),
    shoe: createMesh('official-shoe-instances', geometries.shoe, materials.black, limbCount),
    stripe: createMesh('official-torso-stripe-instances', geometries.stripe, materials.black, stripeCount),
    torso: createMesh('official-striped-torso-instances', geometries.torso, materials.white, officialCount),
  };

  for (const mesh of Object.values(meshes)) {
    mesh.userData.officialsPresentation = true;
    group.add(mesh);
  }

  applySkinColors(meshes.head, officials);
  applySkinColors(meshes.neck, officials);
  syncOfficialVisualResources({ meshes }, officials);

  const metrics = calculateMetrics(meshes);
  const dispose = (): void => {
    group.clear();
    for (const geometry of Object.values(geometries)) {
      geometry.dispose();
    }
    for (const material of Object.values(materials)) {
      material.dispose();
    }
  };

  return {
    dispose,
    group,
    metrics,
    meshes,
  };
}

export function syncOfficialVisualResources(
  resources: Pick<OfficialVisualResources, 'meshes'>,
  officials: readonly OfficialModel[],
): void {
  const matrix = scratch.matrix;

  officials.forEach((official, index) => {
    setOfficialPartMatrix(resources.meshes.torso, index, official, {
      y: dimensions.torsoCenterY,
    });
    setOfficialPartMatrix(resources.meshes.neck, index, official, {
      y: dimensions.neckCenterY,
    });
    setOfficialPartMatrix(resources.meshes.head, index, official, {
      y: dimensions.headCenterY,
    });
    setOfficialPartMatrix(resources.meshes.cap, index, official, {
      y: dimensions.capCenterY,
    });
    setOfficialPartMatrix(resources.meshes.capBrim, index, official, {
      y: dimensions.capBrimCenterY,
      z: OFFICIAL_VISUAL_CONFIG.capRadius * 0.85,
    });

    const armPose = resolveArmPose(official.poseIntent);
    setOfficialPartMatrix(resources.meshes.arm, index * 2, official, {
      rotationZ: armPose.leftRotationZ,
      x: -OFFICIAL_VISUAL_CONFIG.shoulderWidth / 2,
      y: armPose.y,
      z: armPose.z,
    });
    setOfficialPartMatrix(resources.meshes.arm, index * 2 + 1, official, {
      rotationZ: armPose.rightRotationZ,
      x: OFFICIAL_VISUAL_CONFIG.shoulderWidth / 2,
      y: armPose.y,
      z: armPose.z,
    });

    setOfficialPartMatrix(resources.meshes.leg, index * 2, official, {
      rotationZ: 0.08,
      x: -0.12,
      y: dimensions.legCenterY,
    });
    setOfficialPartMatrix(resources.meshes.leg, index * 2 + 1, official, {
      rotationZ: -0.08,
      x: 0.12,
      y: dimensions.legCenterY,
    });
    setOfficialPartMatrix(resources.meshes.shoe, index * 2, official, {
      x: -0.12,
      y: dimensions.shoeCenterY,
      z: OFFICIAL_VISUAL_CONFIG.shoeForwardOffset,
    });
    setOfficialPartMatrix(resources.meshes.shoe, index * 2 + 1, official, {
      x: 0.12,
      y: dimensions.shoeCenterY,
      z: OFFICIAL_VISUAL_CONFIG.shoeForwardOffset,
    });

    for (let stripeIndex = 0; stripeIndex < OFFICIAL_VISUAL_CONFIG.stripeCount; stripeIndex += 1) {
      const local = STRIPE_LOCALS[stripeIndex];
      composeOfficialMatrix(matrix, official, {
        x: local.x,
        y: dimensions.torsoCenterY,
        z: local.z,
      });
      resources.meshes.stripe.setMatrixAt(index * OFFICIAL_VISUAL_CONFIG.stripeCount + stripeIndex, matrix);
    }
  });

  markMatricesDirty(resources.meshes);
}

export function createOfficialsDebugOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'officials-debug-overlay';
  document.body.append(element);
  return element;
}

export function syncOfficialsDebugOverlay(
  element: HTMLElement,
  snapshot: {
    debugLabelsEnabled: boolean;
    enabled: boolean;
    officials: readonly {
      currentPosition: { x: number; z: number };
      distanceFromBall: number;
      id: string;
      role: string;
      targetPosition: { x: number; z: number };
      updateState: string;
    }[];
    visibleOfficialCount: number;
  },
): void {
  element.textContent = [
    'OFFICIALS',
    `enabled ${snapshot.enabled ? 'yes' : 'no'} count ${snapshot.visibleOfficialCount}`,
    `labels ${snapshot.debugLabelsEnabled ? 'on' : 'off'}`,
    ...snapshot.officials.map((official) => {
      const label = OFFICIAL_ROLE_LABELS[official.role as keyof typeof OFFICIAL_ROLE_LABELS] ??
        official.role;
      return [
        `${official.id} ${label}`,
        `pos ${official.currentPosition.x.toFixed(1)},${official.currentPosition.z.toFixed(1)}`,
        `target ${official.targetPosition.x.toFixed(1)},${official.targetPosition.z.toFixed(1)}`,
        `ball ${official.distanceFromBall.toFixed(1)}y ${official.updateState}`,
      ].join(' | ');
    }),
  ].join('\n');
}

const EMPTY_METRICS: OfficialVisualMetrics = {
  geometryCount: 0,
  materialCount: 0,
  meshCount: 0,
  triangleCount: 0,
};

const dimensions = {
  capBrimCenterY:
    OFFICIAL_VISUAL_CONFIG.footHeight +
    OFFICIAL_VISUAL_CONFIG.legLength +
    OFFICIAL_VISUAL_CONFIG.torsoHeight +
    OFFICIAL_VISUAL_CONFIG.neckHeight +
    OFFICIAL_VISUAL_CONFIG.headRadius * 2 +
    OFFICIAL_VISUAL_CONFIG.capHeight * 0.45,
  capCenterY:
    OFFICIAL_VISUAL_CONFIG.footHeight +
    OFFICIAL_VISUAL_CONFIG.legLength +
    OFFICIAL_VISUAL_CONFIG.torsoHeight +
    OFFICIAL_VISUAL_CONFIG.neckHeight +
    OFFICIAL_VISUAL_CONFIG.headRadius * 2 +
    OFFICIAL_VISUAL_CONFIG.capHeight / 2,
  headCenterY:
    OFFICIAL_VISUAL_CONFIG.footHeight +
    OFFICIAL_VISUAL_CONFIG.legLength +
    OFFICIAL_VISUAL_CONFIG.torsoHeight +
    OFFICIAL_VISUAL_CONFIG.neckHeight +
    OFFICIAL_VISUAL_CONFIG.headRadius,
  legCenterY: OFFICIAL_VISUAL_CONFIG.footHeight + OFFICIAL_VISUAL_CONFIG.legLength / 2,
  neckCenterY:
    OFFICIAL_VISUAL_CONFIG.footHeight +
    OFFICIAL_VISUAL_CONFIG.legLength +
    OFFICIAL_VISUAL_CONFIG.torsoHeight +
    OFFICIAL_VISUAL_CONFIG.neckHeight / 2,
  shoeCenterY: OFFICIAL_VISUAL_CONFIG.footHeight / 2,
  torsoCenterY:
    OFFICIAL_VISUAL_CONFIG.footHeight +
    OFFICIAL_VISUAL_CONFIG.legLength +
    OFFICIAL_VISUAL_CONFIG.torsoHeight / 2,
} as const;

const STRIPE_LOCALS = [
  { x: -0.13, z: OFFICIAL_VISUAL_CONFIG.torsoTopRadius + OFFICIAL_VISUAL_CONFIG.stripeDepth / 2 },
  { x: 0.13, z: OFFICIAL_VISUAL_CONFIG.torsoTopRadius + OFFICIAL_VISUAL_CONFIG.stripeDepth / 2 },
  { x: -0.13, z: -OFFICIAL_VISUAL_CONFIG.torsoTopRadius - OFFICIAL_VISUAL_CONFIG.stripeDepth / 2 },
  { x: 0.13, z: -OFFICIAL_VISUAL_CONFIG.torsoTopRadius - OFFICIAL_VISUAL_CONFIG.stripeDepth / 2 },
] as const;

const scratch = {
  baseMatrix: new THREE.Matrix4(),
  localMatrix: new THREE.Matrix4(),
  localQuaternion: new THREE.Quaternion(),
  matrix: new THREE.Matrix4(),
  quaternion: new THREE.Quaternion(),
  scale: new THREE.Vector3(1, 1, 1),
  vector: new THREE.Vector3(),
};

function createGeometries() {
  return {
    arm: new THREE.CylinderGeometry(
      OFFICIAL_VISUAL_CONFIG.armRadius,
      OFFICIAL_VISUAL_CONFIG.armRadius,
      OFFICIAL_VISUAL_CONFIG.armLength,
      5,
      1,
      false,
    ),
    cap: new THREE.CylinderGeometry(
      OFFICIAL_VISUAL_CONFIG.capRadius,
      OFFICIAL_VISUAL_CONFIG.capRadius,
      OFFICIAL_VISUAL_CONFIG.capHeight,
      8,
      1,
    ),
    capBrim: new THREE.BoxGeometry(0.22, 0.035, 0.16),
    head: new THREE.IcosahedronGeometry(OFFICIAL_VISUAL_CONFIG.headRadius, 0),
    leg: new THREE.CylinderGeometry(
      OFFICIAL_VISUAL_CONFIG.legRadius,
      OFFICIAL_VISUAL_CONFIG.legRadius * 0.82,
      OFFICIAL_VISUAL_CONFIG.legLength,
      5,
      1,
      false,
    ),
    neck: new THREE.CylinderGeometry(
      OFFICIAL_VISUAL_CONFIG.neckRadius,
      OFFICIAL_VISUAL_CONFIG.neckRadius,
      OFFICIAL_VISUAL_CONFIG.neckHeight,
      6,
      1,
      false,
    ),
    shoe: new THREE.BoxGeometry(
      OFFICIAL_VISUAL_CONFIG.footWidth,
      OFFICIAL_VISUAL_CONFIG.footHeight,
      OFFICIAL_VISUAL_CONFIG.footDepth,
    ),
    stripe: new THREE.BoxGeometry(
      OFFICIAL_VISUAL_CONFIG.stripeWidth,
      OFFICIAL_VISUAL_CONFIG.torsoHeight * 0.86,
      OFFICIAL_VISUAL_CONFIG.stripeDepth,
    ),
    torso: new THREE.CylinderGeometry(
      OFFICIAL_VISUAL_CONFIG.torsoTopRadius,
      OFFICIAL_VISUAL_CONFIG.torsoBottomRadius,
      OFFICIAL_VISUAL_CONFIG.torsoHeight,
      6,
      1,
      false,
    ),
  } as const;
}

function createMaterials() {
  return {
    black: new THREE.MeshStandardMaterial({
      color: BLACK,
      flatShading: true,
      roughness: 0.85,
    }),
    skin: new THREE.MeshStandardMaterial({
      flatShading: true,
      roughness: 0.8,
      vertexColors: true,
    }),
    white: new THREE.MeshStandardMaterial({
      color: WHITE,
      flatShading: true,
      roughness: 0.85,
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

function applySkinColors(mesh: THREE.InstancedMesh, officials: readonly OfficialModel[]): void {
  officials.forEach((official, index) => {
    const appearance = resolvePlayerAppearance(official.id);
    mesh.setColorAt(index, scratchColor.setHex(appearance.skinColor));
  });
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
}

const scratchColor = new THREE.Color();

function setOfficialPartMatrix(
  mesh: THREE.InstancedMesh,
  index: number,
  official: OfficialModel,
  local: {
    rotationZ?: number;
    x?: number;
    y: number;
    z?: number;
  },
): void {
  composeOfficialMatrix(scratch.matrix, official, local);
  mesh.setMatrixAt(index, scratch.matrix);
}

function composeOfficialMatrix(
  matrix: THREE.Matrix4,
  official: OfficialModel,
  local: {
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
    x?: number;
    y: number;
    z?: number;
  },
): void {
  scratch.quaternion.setFromAxisAngle(Y_AXIS, official.facingRadians);
  scratch.baseMatrix.compose(
    scratch.vector.set(official.position.x, 0, official.position.z),
    scratch.quaternion,
    scratch.scale,
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
    scratch.scale,
  );
  matrix.multiplyMatrices(scratch.baseMatrix, scratch.localMatrix);
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const scratchEuler = new THREE.Euler();

function resolveArmPose(pose: OfficialPoseIntent): {
  leftRotationZ: number;
  rightRotationZ: number;
  y: number;
  z: number;
} {
  if (pose === 'touchdown') {
    return {
      leftRotationZ: -0.18,
      rightRotationZ: 0.18,
      y: dimensions.headCenterY + 0.16,
      z: 0.02,
    };
  }

  if (pose === 'tracking') {
    return {
      leftRotationZ: 0.18,
      rightRotationZ: -0.18,
      y: dimensions.torsoCenterY + 0.02,
      z: 0.02,
    };
  }

  return {
    leftRotationZ: -0.12,
    rightRotationZ: 0.12,
    y: dimensions.torsoCenterY - 0.08,
    z: 0,
  };
}

function markMatricesDirty(meshes: OfficialVisualMeshes): void {
  for (const mesh of Object.values(meshes)) {
    mesh.instanceMatrix.needsUpdate = true;
  }
}

function calculateMetrics(meshes: OfficialVisualMeshes): OfficialVisualMetrics {
  const geometryIds = new Set<string>();
  const materialIds = new Set<string>();
  let triangleCount = 0;

  for (const mesh of Object.values(meshes)) {
    geometryIds.add(mesh.geometry.uuid);
    for (const material of getMaterials(mesh.material)) {
      materialIds.add(material.uuid);
    }
    triangleCount += getGeometryTriangleCount(mesh.geometry) * mesh.count;
  }

  return {
    geometryCount: geometryIds.size,
    materialCount: materialIds.size,
    meshCount: Object.values(meshes).length,
    triangleCount,
  };
}

function getMaterials(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}

function getGeometryTriangleCount(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return geometry.index.count / 3;
  }

  const position = geometry.getAttribute('position');
  return position ? position.count / 3 : 0;
}
