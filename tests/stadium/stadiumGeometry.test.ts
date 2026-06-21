import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_STADIUM_SPEC } from '../../src/stadium/StadiumSpec';
import {
  buildStadiumGeometry,
} from '../../src/stadium/StadiumGeometryBuilder';
import {
  createStadiumMaterialLibrary,
} from '../../src/stadium/StadiumMaterialLibrary';
import { StadiumController } from '../../src/stadium/StadiumController';

describe('stadium geometry builder', () => {
  it('builds a bounded low-poly stadium mesh collection', () => {
    const materials = createStadiumMaterialLibrary({ imageMaterialsEnabled: false });
    const build = buildStadiumGeometry({
      materials,
      spec: DEFAULT_STADIUM_SPEC,
      upperTierEnabled: true,
    });

    expect(build.metrics.drawCalls).toBeGreaterThan(0);
    expect(build.metrics.drawCalls).toBeLessThanOrEqual(20);
    expect(build.metrics.triangles).toBeGreaterThan(1000);
    expect(build.metrics.materialCount).toBeLessThanOrEqual(7);
    expect(build.metrics.geometryCount).toBeLessThanOrEqual(12);

    disposeBuild(build, materials);
  });

  it('keeps stadium vertices outside the protected field and apron bounds', () => {
    const materials = createStadiumMaterialLibrary({ imageMaterialsEnabled: false });
    const build = buildStadiumGeometry({
      materials,
      spec: DEFAULT_STADIUM_SPEC,
      upperTierEnabled: true,
    });
    build.group.updateMatrixWorld(true);

    const violations: string[] = [];
    build.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      const position = object.geometry.getAttribute('position');
      for (let index = 0; index < position.count; index += 1) {
        const point = new THREE.Vector3(
          position.getX(index),
          position.getY(index),
          position.getZ(index),
        ).applyMatrix4(object.matrixWorld);
        if (!isOutsideProtectedBounds(point)) {
          violations.push(`${object.name}:${index}`);
        }
      }
    });

    expect(violations).toEqual([]);

    disposeBuild(build, materials);
  });

  it('provides controller snapshots for active and disabled stadium states', () => {
    const controller = new StadiumController({
      enabled: true,
      imageMaterialsEnabled: false,
      renderer: createFakeRenderer(),
      upperTierEnabled: false,
    });

    const enabledSnapshot = controller.getSnapshot();
    expect(enabledSnapshot.enabled).toBe(true);
    expect(enabledSnapshot.upperTierEnabled).toBe(false);
    expect(enabledSnapshot.seatCount).toBeGreaterThan(0);
    expect(enabledSnapshot.textureCount).toBe(0);

    controller.applySettings({
      enabled: false,
      imageMaterialsEnabled: false,
      upperTierEnabled: false,
    });
    expect(controller.getSnapshot()).toMatchObject({
      drawCalls: 0,
      enabled: false,
      geometryCount: 0,
      triangles: 0,
    });

    controller.dispose();
  });

  it('disposes owned stadium geometries and materials', () => {
    const controller = new StadiumController({
      enabled: true,
      imageMaterialsEnabled: false,
      renderer: createFakeRenderer(),
      upperTierEnabled: true,
    });
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();

    controller.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      geometries.add(object.geometry);
      for (const material of getMaterials(object.material)) {
        materials.add(material);
      }
    });

    const geometrySpies = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialSpies = [...materials].map((material) => vi.spyOn(material, 'dispose'));

    controller.dispose();

    expect(geometrySpies.length).toBeGreaterThan(0);
    expect(materialSpies.length).toBeGreaterThan(0);
    expect(geometrySpies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    expect(materialSpies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
  });
});

function isOutsideProtectedBounds(point: THREE.Vector3): boolean {
  const bounds = DEFAULT_STADIUM_SPEC.protectedFieldBounds;
  const epsilon = 1e-5;
  return point.x <= bounds.minX - epsilon ||
    point.x >= bounds.maxX + epsilon ||
    point.z <= bounds.minZ - epsilon ||
    point.z >= bounds.maxZ + epsilon;
}

function disposeBuild(
  build: ReturnType<typeof buildStadiumGeometry>,
  materials: ReturnType<typeof createStadiumMaterialLibrary>,
): void {
  for (const geometry of new Set(build.geometries)) {
    geometry.dispose();
  }
  materials.dispose();
}

function createFakeRenderer(): THREE.WebGLRenderer {
  return {
    capabilities: {
      getMaxAnisotropy: () => 4,
    },
  } as unknown as THREE.WebGLRenderer;
}

function getMaterials(material: THREE.Material | THREE.Material[]): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}
