import * as THREE from 'three';
import { createPlayerModel } from '../../playerModel';
import {
  createPlaceholderPlayerVisual,
  syncPlayerVisual,
} from '../../playerVisual';
import type { TeamPresentationTheme } from '../../teams/TeamThemeApplier';
import {
  createSidelineVisualResources,
  type SidelineVisualResources,
} from '../teams/SidelineVisualFactory';
import type { SidelinePlayerPlacement, SidelinePoseId } from '../teams/SidelineTeamTypes';
import type {
  PregameWarmupLayout,
  PregameWarmupPlacement,
  PregameWarmupPropPlacement,
} from './PregameWarmupTypes';

export interface PregameWarmupVisualResources {
  dispose: () => void;
  group: THREE.Group;
  metrics: WarmupVisualMetrics;
  quarterbackClone: THREE.Group | null;
}

export interface WarmupVisualMetrics {
  drawCalls: number;
  geometryCount: number;
  instanceBufferBytes: number;
  materialCount: number;
  meshCount: number;
  textureCount: number;
  triangleCount: number;
}

const HELD_FOOTBALL_CONFIG = {
  color: 0x7a3f1f,
  diameter: 0.16,
  length: 0.29,
} as const;

const EMPTY_METRICS: WarmupVisualMetrics = {
  drawCalls: 0,
  geometryCount: 0,
  instanceBufferBytes: 0,
  materialCount: 0,
  meshCount: 0,
  textureCount: 0,
  triangleCount: 0,
} as const;

const scratch = {
  matrix: new THREE.Matrix4(),
  quaternion: new THREE.Quaternion(),
  scale: new THREE.Vector3(),
  vector: new THREE.Vector3(),
};
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export function createPregameWarmupVisualResources(
  layout: PregameWarmupLayout,
  theme: TeamPresentationTheme,
): PregameWarmupVisualResources {
  const group = new THREE.Group();
  group.name = 'pregame-warmup-root';
  group.userData.pregameWarmup = true;

  const supportPlacements = layout.placements
    .filter((placement) => placement !== layout.userQuarterback)
    .map(toSidelinePlacement);
  const supportResources = supportPlacements.length > 0
    ? createSidelineVisualResources(supportPlacements, theme)
    : null;
  if (supportResources) {
    supportResources.group.name = 'pregame-warmup-support-instances';
    supportResources.group.userData.pregameWarmup = true;
    group.add(supportResources.group);
  }

  const quarterbackClone = layout.userQuarterback
    ? createQuarterbackClone(layout.userQuarterback, theme)
    : null;
  if (quarterbackClone) {
    group.add(quarterbackClone);
  }

  const props = createPropResources(layout.props);
  if (props.group.children.length > 0) {
    group.add(props.group);
  }

  const metrics = mergeMetrics(
    supportResources?.metrics ?? EMPTY_METRICS,
    props.metrics,
    quarterbackClone ? measureObjectMetrics(quarterbackClone) : EMPTY_METRICS,
  );

  return {
    dispose: () => {
      group.clear();
      supportResources?.dispose();
      props.dispose();
      if (quarterbackClone) {
        disposeQuarterbackCloneOwnedResources(quarterbackClone);
        quarterbackClone.removeFromParent();
      }
    },
    group,
    metrics,
    quarterbackClone,
  };
}

function disposeQuarterbackCloneOwnedResources(quarterbackClone: THREE.Object3D): void {
  const football = quarterbackClone.getObjectByName('pregame-warmup-held-football');
  if (!(football instanceof THREE.Mesh)) {
    return;
  }

  football.geometry.dispose();
  for (const material of getMaterials(football.material)) {
    material.dispose();
  }
}

export function createEmptyWarmupVisualMetrics(): WarmupVisualMetrics {
  return { ...EMPTY_METRICS };
}

function createQuarterbackClone(
  placement: PregameWarmupPlacement,
  theme: TeamPresentationTheme,
): THREE.Group {
  const model = createPlayerModel(placement.position, {
    facingRadians: placement.facingRadians,
    id: placement.player?.id ?? placement.id,
    role: 'quarterback',
    state: 'idle',
    team: placement.team,
  });
  const visual = createPlaceholderPlayerVisual(model, {
    teamUniforms: theme.uniforms,
  });
  visual.name = 'pregame-warmup-quarterback-clone';
  visual.userData.pregameWarmup = true;
  visual.userData.presentationOnly = true;
  visual.userData.rosterPlayerId = placement.player?.id ?? null;
  syncPlayerVisual(visual, model, { teamUniforms: theme.uniforms });

  const football = createHeldFootball();
  football.position.set(0.36, 0.08, 0.35);
  football.rotation.set(0.1, Math.PI / 2, -0.25);
  visual.add(football);
  return visual;
}

function createHeldFootball(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(
    HELD_FOOTBALL_CONFIG.diameter / 2,
    8,
    6,
  );
  geometry.scale(
    HELD_FOOTBALL_CONFIG.length / HELD_FOOTBALL_CONFIG.diameter,
    0.82,
    1,
  );
  const material = new THREE.MeshLambertMaterial({
    color: HELD_FOOTBALL_CONFIG.color,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'pregame-warmup-held-football';
  mesh.userData.pregameWarmup = true;
  return mesh;
}

function createPropResources(props: readonly PregameWarmupPropPlacement[]): {
  dispose: () => void;
  group: THREE.Group;
  metrics: WarmupVisualMetrics;
} {
  const group = new THREE.Group();
  group.name = 'pregame-warmup-props';
  group.userData.pregameWarmup = true;
  const cones = props.filter((prop) => prop.role === 'cone');
  const footballs = props.filter((prop) => prop.role === 'football');
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const meshes: THREE.InstancedMesh[] = [];

  if (cones.length > 0) {
    const geometry = new THREE.ConeGeometry(0.17, 0.42, 6);
    const material = new THREE.MeshLambertMaterial({ color: 0xff8a2a, flatShading: true });
    const mesh = createPropMesh('pregame-warmup-cones', geometry, material, cones);
    geometries.push(geometry);
    materials.push(material);
    meshes.push(mesh);
    group.add(mesh);
  }

  if (footballs.length > 0) {
    const geometry = new THREE.SphereGeometry(0.09, 8, 6);
    geometry.scale(1.65, 0.82, 1);
    const material = new THREE.MeshLambertMaterial({ color: HELD_FOOTBALL_CONFIG.color, flatShading: true });
    const mesh = createPropMesh('pregame-warmup-footballs', geometry, material, footballs);
    geometries.push(geometry);
    materials.push(material);
    meshes.push(mesh);
    group.add(mesh);
  }

  return {
    dispose: () => {
      group.clear();
      for (const geometry of geometries) {
        geometry.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
    },
    group,
    metrics: {
      drawCalls: meshes.length,
      geometryCount: geometries.length,
      instanceBufferBytes: meshes.reduce((sum, mesh) => sum + mesh.count * 16 * Float32Array.BYTES_PER_ELEMENT, 0),
      materialCount: materials.length,
      meshCount: meshes.length,
      textureCount: 0,
      triangleCount: meshes.reduce((sum, mesh) => sum + countGeometryTriangles(mesh.geometry) * mesh.count, 0),
    },
  };
}

function createPropMesh(
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  placements: readonly PregameWarmupPropPlacement[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  mesh.name = name;
  mesh.userData.pregameWarmup = true;
  placements.forEach((placement, index) => {
    scratch.quaternion.setFromAxisAngle(Y_AXIS, placement.facingRadians);
    scratch.matrix.compose(
      scratch.vector.set(placement.position.x, placement.position.y + 0.21, placement.position.z),
      scratch.quaternion,
      scratch.scale.set(placement.scale, placement.scale, placement.scale),
    );
    mesh.setMatrixAt(index, scratch.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function toSidelinePlacement(placement: PregameWarmupPlacement): SidelinePlayerPlacement {
  return {
    appearanceId: placement.appearanceId,
    facingRadians: placement.facingRadians,
    id: placement.id,
    position: placement.position,
    pose: toSidelinePose(placement.pose),
    scale: placement.scale,
    team: placement.team,
    teamSide: placement.teamSide,
    zoneId: placement.teamSide === 'user' ? 'user-sideline' : 'opponent-sideline',
  };
}

function toSidelinePose(pose: PregameWarmupPlacement['pose']): SidelinePoseId {
  if (pose === 'staggeredStance') {
    return 'crouched';
  }
  return pose;
}

function measureObjectMetrics(object: THREE.Object3D): WarmupVisualMetrics {
  const geometries = new Set<string>();
  const materials = new Set<string>();
  const textures = new Set<string>();
  let drawCalls = 0;
  let triangleCount = 0;

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    drawCalls += 1;
    geometries.add(child.geometry.uuid);
    triangleCount += countGeometryTriangles(child.geometry);
    for (const material of getMaterials(child.material)) {
      materials.add(material.uuid);
      const maybeMap = (material as THREE.Material & { map?: THREE.Texture | null }).map;
      if (maybeMap) {
        textures.add(maybeMap.uuid);
      }
    }
  });

  return {
    drawCalls,
    geometryCount: geometries.size,
    instanceBufferBytes: 0,
    materialCount: materials.size,
    meshCount: drawCalls,
    textureCount: textures.size,
    triangleCount,
  };
}

function mergeMetrics(...entries: readonly WarmupVisualMetrics[]): WarmupVisualMetrics {
  return entries.reduce(
    (sum, entry) => ({
      drawCalls: sum.drawCalls + entry.drawCalls,
      geometryCount: sum.geometryCount + entry.geometryCount,
      instanceBufferBytes: sum.instanceBufferBytes + entry.instanceBufferBytes,
      materialCount: sum.materialCount + entry.materialCount,
      meshCount: sum.meshCount + entry.meshCount,
      textureCount: sum.textureCount + entry.textureCount,
      triangleCount: sum.triangleCount + entry.triangleCount,
    }),
    { ...EMPTY_METRICS },
  );
}

function countGeometryTriangles(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return geometry.index.count / 3;
  }
  const position = geometry.getAttribute('position');
  return position ? position.count / 3 : 0;
}

function getMaterials(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}
