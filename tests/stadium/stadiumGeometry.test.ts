import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { FIELD_DIMENSIONS } from '../../src/fieldSpec';
import { PRESENTATION_CONFIG } from '../../src/field/FieldMarkingLayout';
import { DEFAULT_STADIUM_SPEC } from '../../src/stadium/StadiumSpec';
import { createStadiumRows } from '../../src/stadium/StadiumLayout';
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
    expect(build.group.getObjectByName('stadium-lower-bowl-closure')).toBeInstanceOf(THREE.Mesh);
    expect(build.group.getObjectByName('stadium-inner-apron-floor')).toBeUndefined();
    expect(build.group.getObjectByName('stadium-inner-bowl-wall')).toBeUndefined();

    disposeBuild(build, materials);
  });

  it('keeps the stadium ground closure outside the visible field footprint', () => {
    const materials = createStadiumMaterialLibrary({ imageMaterialsEnabled: false });
    const build = buildStadiumGeometry({
      materials,
      spec: DEFAULT_STADIUM_SPEC,
      upperTierEnabled: true,
    });
    const closure = build.group.getObjectByName('stadium-lower-bowl-closure');

    expect(closure).toBeInstanceOf(THREE.Mesh);
    expect(findClosureFieldFootprintViolations(closure as THREE.Mesh)).toEqual([]);

    disposeBuild(build, materials);
  });

  it('uses double-sided stadium shell materials so the sky cannot show through back-facing bowl surfaces', () => {
    const materials = createStadiumMaterialLibrary({ imageMaterialsEnabled: false });

    for (const material of materials.allMaterials) {
      expect(material.side).toBe(THREE.DoubleSide);
    }

    materials.dispose();
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

  it('keeps the continuous exterior wall above the upper seating rim for 360 camera views', () => {
    const materials = createStadiumMaterialLibrary({ imageMaterialsEnabled: false });
    const build = buildStadiumGeometry({
      materials,
      spec: DEFAULT_STADIUM_SPEC,
      upperTierEnabled: true,
    });
    const exteriorWall = build.group.getObjectByName('stadium-exterior-wall');
    const upperRows = createStadiumRows(DEFAULT_STADIUM_SPEC, true)
      .filter((row) => row.tier > 0);
    const upperSeatTop = Math.max(
      ...upperRows.map((row) => row.elevation + DEFAULT_STADIUM_SPEC.rowRise * 0.42),
    );

    expect(exteriorWall).toBeInstanceOf(THREE.Mesh);
    const exteriorWallBounds = new THREE.Box3().setFromObject(exteriorWall!);

    expect(exteriorWallBounds.max.y).toBeGreaterThanOrEqual(upperSeatTop + 6);

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

  it('adds a bounded mountain backdrop for the mountain bowl stadium theme', () => {
    const materials = createStadiumMaterialLibrary({ imageMaterialsEnabled: false });
    const build = buildStadiumGeometry({
      materials,
      spec: DEFAULT_STADIUM_SPEC,
      themeId: 'mountainBowl',
      upperTierEnabled: true,
    });

    expect(build.group.getObjectByName('mountain-bowl-backdrop')).toBeInstanceOf(THREE.Group);
    expect(build.mountainBowl).toMatchObject({
      edgeFeathered: true,
      layerCount: 4,
      ridgeCount: 3,
      treeLineCount: 24,
    });
    expect(build.mountainBowl?.peakCount).toBeGreaterThanOrEqual(30);
    expect(build.mountainBowl?.rockFacetCount).toBeGreaterThanOrEqual(15);
    expect(build.mountainBowl?.snowCapCount).toBeGreaterThan(0);
    expect(build.mountainBowl?.bounds.minZ).toBeGreaterThan(FIELD_DIMENSIONS.fieldLength / 2);
    expect(build.mountainBowl?.bounds.maxY).toBeGreaterThan(55);
    expect(build.metrics.triangles).toBeGreaterThan(build.mountainBowl?.triangleCount ?? 0);

    disposeBuild(build, materials);
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

function findClosureFieldFootprintViolations(mesh: THREE.Mesh): string[] {
  const fieldGroundHalfWidth = FIELD_DIMENSIONS.fieldWidth / 2 + PRESENTATION_CONFIG.groundMargin - 0.12;
  const fieldGroundHalfDepth = FIELD_DIMENSIONS.fieldLength / 2 + PRESENTATION_CONFIG.groundMargin - 0.12;
  const position = mesh.geometry.getAttribute('position');
  const violations: string[] = [];

  for (let index = 0; index < position.count; index += 1) {
    const point = new THREE.Vector3(
      position.getX(index),
      position.getY(index),
      position.getZ(index),
    ).applyMatrix4(mesh.matrixWorld);
    if (
      Math.abs(point.x) < fieldGroundHalfWidth &&
      Math.abs(point.z) < fieldGroundHalfDepth
    ) {
      violations.push(`${index}:${point.x.toFixed(2)},${point.z.toFixed(2)}`);
    }
  }

  return violations;
}

function disposeBuild(
  build: ReturnType<typeof buildStadiumGeometry>,
  materials: ReturnType<typeof createStadiumMaterialLibrary>,
): void {
  for (const geometry of new Set(build.geometries)) {
    geometry.dispose();
  }
  for (const material of new Set(build.materials)) {
    material.dispose();
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
