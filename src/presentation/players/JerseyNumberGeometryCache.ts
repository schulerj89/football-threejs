import * as THREE from 'three';
import {
  resolveJerseyNumberAtlasCell,
  type JerseyNumberAtlasCell,
} from './JerseyNumberAtlas';

export interface JerseyNumberGeometrySnapshot {
  cachedGeometryCount: number;
  cachedNumbers: number[];
}

const JERSEY_NUMBER_GEOMETRY_CONFIG = {
  height: 0.36,
  width: 0.46,
} as const;

const geometryCache = new Map<number, THREE.BufferGeometry>();

export function getJerseyNumberGeometry(number: number): THREE.BufferGeometry {
  const normalized = normalizeJerseyNumber(number);
  const cached = geometryCache.get(normalized);
  if (cached) {
    return cached;
  }

  const cell = resolveJerseyNumberAtlasCell(normalized);
  const geometry = createNumberPlaneGeometry(cell);
  geometry.name = `jersey-number-${normalized}-geometry`;
  geometryCache.set(normalized, geometry);
  return geometry;
}

export function getJerseyNumberGeometrySnapshot(): JerseyNumberGeometrySnapshot {
  return {
    cachedGeometryCount: geometryCache.size,
    cachedNumbers: [...geometryCache.keys()].sort((a, b) => a - b),
  };
}

function createNumberPlaneGeometry(cell: JerseyNumberAtlasCell): THREE.BufferGeometry {
  const halfWidth = JERSEY_NUMBER_GEOMETRY_CONFIG.width / 2;
  const halfHeight = JERSEY_NUMBER_GEOMETRY_CONFIG.height / 2;
  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([
      -halfWidth, -halfHeight, 0,
      halfWidth, -halfHeight, 0,
      halfWidth, halfHeight, 0,
      -halfWidth, halfHeight, 0,
    ], 3),
  );
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute([
      cell.u0, cell.v0,
      cell.u1, cell.v0,
      cell.u1, cell.v1,
      cell.u0, cell.v1,
    ], 2),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function normalizeJerseyNumber(number: number): number {
  return Math.min(99, Math.max(0, Math.trunc(number)));
}
