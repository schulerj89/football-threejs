import * as THREE from 'three';

export interface RendererPerformanceMetrics {
  calls: number;
  geometries: number;
  lines: number;
  points: number;
  textures: number;
  triangles: number;
}

export interface SceneStructureMetrics {
  crowdInstanceCount: number;
  helmetCount: number;
  lightCount: number;
  materialCount: number;
  object3DCount: number;
  officialMeshCount: number;
  playerMeshCount: number;
  shadowCastingObjectCount: number;
  stadiumMeshCount: number;
  visibleMeshCount: number;
}

export interface ResourceChangeSnapshot {
  geometries: number;
  materialCount: number;
  object3DCount: number;
  textures: number;
}

export function collectRendererMetrics(renderer: THREE.WebGLRenderer): RendererPerformanceMetrics {
  return {
    calls: renderer.info.render.calls,
    geometries: renderer.info.memory.geometries,
    lines: renderer.info.render.lines,
    points: renderer.info.render.points,
    textures: renderer.info.memory.textures,
    triangles: renderer.info.render.triangles,
  };
}

export function collectSceneStructureMetrics(
  scene: THREE.Scene,
  playerVisuals: Iterable<THREE.Object3D>,
): SceneStructureMetrics {
  const materialIds = new Set<string>();
  const playerVisualSet = new Set<THREE.Object3D>(playerVisuals);
  let crowdInstanceCount = 0;
  let helmetCount = 0;
  let lightCount = 0;
  let object3DCount = 0;
  let officialMeshCount = 0;
  let playerMeshCount = 0;
  let shadowCastingObjectCount = 0;
  let stadiumMeshCount = 0;
  let visibleMeshCount = 0;

  scene.traverse((object) => {
    object3DCount += 1;

    if (object instanceof THREE.Light) {
      lightCount += 1;
    }

    if (object.castShadow) {
      shadowCastingObjectCount += 1;
    }

    if (object.name === 'low-poly-helmet') {
      helmetCount += 1;
    }

    if (object instanceof THREE.InstancedMesh && isCrowdObject(object)) {
      crowdInstanceCount += object.count;
    }

    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    for (const material of getMaterials(object.material)) {
      materialIds.add(material.uuid);
    }

    if (object.visible) {
      visibleMeshCount += 1;
    }

    if (isOfficialObject(object)) {
      officialMeshCount += 1;
    }

    if (isStadiumObject(object)) {
      stadiumMeshCount += 1;
    }

    if (isDescendantOfAny(object, playerVisualSet)) {
      playerMeshCount += 1;
    }
  });

  return {
    crowdInstanceCount,
    helmetCount,
    lightCount,
    materialCount: materialIds.size,
    object3DCount,
    officialMeshCount,
    playerMeshCount,
    shadowCastingObjectCount,
    stadiumMeshCount,
    visibleMeshCount,
  };
}

export function createResourceChangeSnapshot(
  renderer: THREE.WebGLRenderer,
  sceneStructure: SceneStructureMetrics,
): ResourceChangeSnapshot {
  return {
    geometries: renderer.info.memory.geometries,
    materialCount: sceneStructure.materialCount,
    object3DCount: sceneStructure.object3DCount,
    textures: renderer.info.memory.textures,
  };
}

export function hasResourceChanged(
  previous: ResourceChangeSnapshot | null,
  next: ResourceChangeSnapshot,
): boolean {
  return !!previous &&
    (
      previous.geometries !== next.geometries ||
      previous.materialCount !== next.materialCount ||
      previous.object3DCount !== next.object3DCount ||
      previous.textures !== next.textures
    );
}

function isDescendantOfAny(
  object: THREE.Object3D,
  roots: ReadonlySet<THREE.Object3D>,
): boolean {
  let current: THREE.Object3D | null = object;

  while (current) {
    if (roots.has(current)) {
      return true;
    }
    current = current.parent;
  }

  return false;
}

function isCrowdObject(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object;

  while (current) {
    if (current.userData.crowdPresentation || current.name.includes('crowd')) {
      return true;
    }
    current = current.parent;
  }

  return false;
}

function isOfficialObject(object: THREE.Object3D): boolean {
  return /official|referee/i.test(object.name);
}

function isStadiumObject(object: THREE.Object3D): boolean {
  return /stadium|stand|seating|crowd-seating-shell/i.test(object.name);
}

function getMaterials(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}
