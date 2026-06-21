import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FIELD_BOUNDS, createFootballField } from '../src/field';

const BOUNDS_EPSILON = 0.00001;

describe('field geometry integration', () => {
  it('keeps every painted line mesh inside the field surface world bounds', () => {
    const field = createFootballField();
    const paintedLineMeshes: THREE.Mesh[] = [];

    field.group.updateMatrixWorld(true);
    field.group.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.isPaintedFieldMarking === true) {
        paintedLineMeshes.push(object);
      }
    });

    expect(paintedLineMeshes.length).toBeGreaterThan(0);

    for (const mesh of paintedLineMeshes) {
      const bounds = new THREE.Box3().setFromObject(mesh);

      expect(bounds.min.x, mesh.name).toBeGreaterThanOrEqual(FIELD_BOUNDS.minX - BOUNDS_EPSILON);
      expect(bounds.max.x, mesh.name).toBeLessThanOrEqual(FIELD_BOUNDS.maxX + BOUNDS_EPSILON);
      expect(bounds.min.z, mesh.name).toBeGreaterThanOrEqual(FIELD_BOUNDS.minZ - BOUNDS_EPSILON);
      expect(bounds.max.z, mesh.name).toBeLessThanOrEqual(FIELD_BOUNDS.maxZ + BOUNDS_EPSILON);
    }
  });
});
