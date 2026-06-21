import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFootballField } from '../../src/field';

describe('field direction marker', () => {
  it('does not add a play-direction arrow or direction-marker mesh to a normal field', () => {
    const field = createFootballField();

    try {
      const directionMarkerObjects: string[] = [];

      field.group.traverse((object) => {
        const name = object.name.toLowerCase();
        const isDirectionMarkerName =
          name.includes('play-direction') ||
          name.includes('direction-marker') ||
          name.includes('direction-arrow') ||
          name.includes('arrow');

        if (isDirectionMarkerName && (object instanceof THREE.Mesh || object instanceof THREE.Group)) {
          directionMarkerObjects.push(`${object.type}:${object.name}`);
        }
      });

      expect(directionMarkerObjects).toEqual([]);
      expect(field.group.getObjectByName('play-direction-marker')).toBeUndefined();

      const firstDownLine = field.group.getObjectByName('first-down-line');
      expect(firstDownLine).toBe(field.firstDownLineMarker);
      expect(firstDownLine).toBeInstanceOf(THREE.Mesh);

      const material = (firstDownLine as THREE.Mesh).material;
      expect(Array.isArray(material)).toBe(false);
      expect((material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xf2d94b);
    } finally {
      field.dispose();
    }
  });
});
