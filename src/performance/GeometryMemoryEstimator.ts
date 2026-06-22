import * as THREE from 'three';
import type { CalculatedBufferMemorySnapshot } from './MemoryTypes';

export function createEmptyBufferMemorySnapshot(): CalculatedBufferMemorySnapshot {
  return {
    attributeBytes: 0,
    customInstanceAttributeBytes: 0,
    geometryIndexBytes: 0,
    instanceColorBytes: 0,
    instanceMatrixBytes: 0,
    morphAttributeBytes: 0,
    totalBytes: 0,
  };
}

export function addBufferMemorySnapshots(
  a: CalculatedBufferMemorySnapshot,
  b: CalculatedBufferMemorySnapshot,
): CalculatedBufferMemorySnapshot {
  return finalizeBufferMemorySnapshot({
    attributeBytes: a.attributeBytes + b.attributeBytes,
    customInstanceAttributeBytes:
      a.customInstanceAttributeBytes + b.customInstanceAttributeBytes,
    geometryIndexBytes: a.geometryIndexBytes + b.geometryIndexBytes,
    instanceColorBytes: a.instanceColorBytes + b.instanceColorBytes,
    instanceMatrixBytes: a.instanceMatrixBytes + b.instanceMatrixBytes,
    morphAttributeBytes: a.morphAttributeBytes + b.morphAttributeBytes,
    totalBytes: 0,
  });
}

export function estimateGeometryBufferBytes(
  geometry: THREE.BufferGeometry,
): CalculatedBufferMemorySnapshot {
  const countedBuffers = new Set<ArrayBufferLike>();
  const snapshot = createEmptyBufferMemorySnapshot();

  for (const attribute of Object.values(geometry.attributes)) {
    if (attribute instanceof THREE.InstancedBufferAttribute) {
      snapshot.customInstanceAttributeBytes += byteLengthForAttribute(
        attribute,
        countedBuffers,
      );
    } else {
      snapshot.attributeBytes += byteLengthForAttribute(attribute, countedBuffers);
    }
  }

  if (geometry.index) {
    snapshot.geometryIndexBytes += byteLengthForAttribute(geometry.index, countedBuffers);
  }

  for (const attributes of Object.values(geometry.morphAttributes)) {
    for (const attribute of attributes) {
      snapshot.morphAttributeBytes += byteLengthForAttribute(attribute, countedBuffers);
    }
  }

  return finalizeBufferMemorySnapshot(snapshot);
}

export function estimateInstancedMeshBufferBytes(
  mesh: THREE.InstancedMesh,
): CalculatedBufferMemorySnapshot {
  const snapshot = createEmptyBufferMemorySnapshot();
  snapshot.instanceMatrixBytes = mesh.instanceMatrix.array.byteLength;
  snapshot.instanceColorBytes = mesh.instanceColor?.array.byteLength ?? 0;
  return finalizeBufferMemorySnapshot(snapshot);
}

export function estimateSceneGeometryBufferBytes(
  root: THREE.Object3D,
): CalculatedBufferMemorySnapshot {
  const geometries = new Set<THREE.BufferGeometry>();
  const snapshot = createEmptyBufferMemorySnapshot();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) {
      return;
    }

    if (!geometries.has(object.geometry)) {
      geometries.add(object.geometry);
      mergeInto(snapshot, estimateGeometryBufferBytes(object.geometry));
    }

    if (object instanceof THREE.InstancedMesh) {
      mergeInto(snapshot, estimateInstancedMeshBufferBytes(object));
    }
  });

  return finalizeBufferMemorySnapshot(snapshot);
}

export function finalizeBufferMemorySnapshot(
  snapshot: CalculatedBufferMemorySnapshot,
): CalculatedBufferMemorySnapshot {
  const totalBytes =
    snapshot.attributeBytes +
    snapshot.customInstanceAttributeBytes +
    snapshot.geometryIndexBytes +
    snapshot.instanceColorBytes +
    snapshot.instanceMatrixBytes +
    snapshot.morphAttributeBytes;
  return {
    ...snapshot,
    totalBytes,
  };
}

function mergeInto(
  target: CalculatedBufferMemorySnapshot,
  source: CalculatedBufferMemorySnapshot,
): void {
  target.attributeBytes += source.attributeBytes;
  target.customInstanceAttributeBytes += source.customInstanceAttributeBytes;
  target.geometryIndexBytes += source.geometryIndexBytes;
  target.instanceColorBytes += source.instanceColorBytes;
  target.instanceMatrixBytes += source.instanceMatrixBytes;
  target.morphAttributeBytes += source.morphAttributeBytes;
  target.totalBytes = 0;
}

function byteLengthForAttribute(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  countedBuffers: Set<ArrayBufferLike>,
): number {
  const array = attribute instanceof THREE.InterleavedBufferAttribute
    ? attribute.data.array
    : attribute.array;
  const buffer = array.buffer;

  if (countedBuffers.has(buffer)) {
    return 0;
  }

  countedBuffers.add(buffer);
  return array.byteLength;
}
