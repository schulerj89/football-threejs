import * as THREE from 'three';
import type { SidelineVisualMetrics } from './SidelineTeamTypes';

export const SIDELINE_TRANSFORM_MATRIX_BYTES = 16 * Float32Array.BYTES_PER_ELEMENT;
export const SIDELINE_INSTANCE_COLOR_BYTES = 3 * Float32Array.BYTES_PER_ELEMENT;

export function estimateSidelineInstanceBufferBytes(meshes: readonly THREE.InstancedMesh[]): number {
  return meshes.reduce(
    (sum, mesh) =>
      sum + mesh.count * (SIDELINE_TRANSFORM_MATRIX_BYTES + SIDELINE_INSTANCE_COLOR_BYTES),
    0,
  );
}

export function createSidelineVisualMetrics(
  group: THREE.Group,
  meshes: readonly THREE.InstancedMesh[],
  geometries: readonly THREE.BufferGeometry[],
  materials: readonly THREE.Material[],
): SidelineVisualMetrics {
  return {
    drawCalls: countSidelineDrawCalls(group),
    geometryCount: new Set(geometries.map((geometry) => geometry.uuid)).size,
    instanceBufferBytes: estimateSidelineInstanceBufferBytes(meshes),
    materialCount: new Set(materials.map((material) => material.uuid)).size,
    meshCount: meshes.length,
    textureCount: countTextures(materials),
    triangleCount: countSidelineTriangles(meshes),
  };
}

export function countSidelineDrawCalls(group: THREE.Group): number {
  let drawCalls = 0;
  group.traverse((object) => {
    if (object instanceof THREE.Mesh && object.visible) {
      drawCalls += 1;
    }
  });
  return drawCalls;
}

export function countSidelineTriangles(meshes: readonly THREE.InstancedMesh[]): number {
  return meshes.reduce(
    (sum, mesh) => sum + countGeometryTriangles(mesh.geometry) * mesh.count,
    0,
  );
}

function countTextures(materials: readonly THREE.Material[]): number {
  const textures = new Set<string>();
  for (const material of materials) {
    const maybeMap = (material as THREE.Material & { map?: THREE.Texture | null }).map;
    if (maybeMap) {
      textures.add(maybeMap.uuid);
    }
  }
  return textures.size;
}

function countGeometryTriangles(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return geometry.index.count / 3;
  }
  const position = geometry.getAttribute('position');
  return position ? position.count / 3 : 0;
}
