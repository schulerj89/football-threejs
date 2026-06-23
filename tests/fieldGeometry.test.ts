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

  it('batches static painted field markings into a small set of meshes', () => {
    const field = createFootballField();
    const staticBatches: THREE.Mesh[] = [];
    const independentStaticHashesOrYardLines: string[] = [];

    field.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }

      if (object.userData.staticFieldMarkingBatch === true) {
        staticBatches.push(object);
      }

      if (/^(left-hash|right-hash|yard-line)-/.test(object.name)) {
        independentStaticHashesOrYardLines.push(object.name);
      }
    });

    expect(staticBatches.length).toBeGreaterThan(0);
    expect(staticBatches.length).toBeLessThanOrEqual(5);
    expect(independentStaticHashesOrYardLines).toEqual([]);
    expect(field.group.getObjectByName('line-of-scrimmage')).toBeInstanceOf(THREE.Mesh);
    expect(field.group.getObjectByName('first-down-line')).toBeInstanceOf(THREE.Mesh);
    expect(field.group.getObjectByName('play-direction-marker')).toBeUndefined();
  });

  it('adds presentation-only field elements without changing gameplay bounds', () => {
    const field = createFootballField();

    expect(field.group.getObjectByName('surrounding-ground-plane')).toBeInstanceOf(THREE.Mesh);
    expect(field.group.getObjectByName('sideline-apron')).toBeInstanceOf(THREE.Mesh);
    expect(field.group.getObjectByName('yard-numbers')).toBeInstanceOf(THREE.Mesh);
    expect(field.group.getObjectByName('team-box-boundaries')).toBeInstanceOf(THREE.Mesh);

    const goalposts = field.group.getObjectByName('goalposts');
    expect(goalposts).toBeInstanceOf(THREE.Mesh);
    expect(goalposts?.userData.endLineZs).toEqual([FIELD_BOUNDS.minZ, FIELD_BOUNDS.maxZ]);

    const pylons = field.group.getObjectByName('end-zone-pylons');
    expect(pylons).toBeInstanceOf(THREE.Mesh);
    expect(pylons?.userData.presentationOnly).toBe(true);
    expect(pylons?.userData.endZonePylons).toBe(true);
    expect(pylons?.userData.pylonIds).toHaveLength(8);
  });
});
