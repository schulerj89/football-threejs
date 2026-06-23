import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  CrowdPreviewController,
  clampCrowdCount,
  createCrowdPlacements,
  resolveCrowdBenchmarkDurationSeconds,
  resolveCrowdPreviewCameraView,
  resolveCrowdPreviewCount,
  resolveCrowdPreviewEnabled,
} from '../src/crowdPreview';

describe('crowd preview', () => {
  it('resolves query controls and clamps requested counts safely', () => {
    expect(resolveCrowdPreviewEnabled(new URLSearchParams('crowdPreview=1'))).toBe(true);
    expect(resolveCrowdPreviewEnabled(new URLSearchParams('crowdPreview=0'))).toBe(false);
    expect(resolveCrowdPreviewCount(new URLSearchParams('crowdCount=2000'))).toBe(2000);
    expect(resolveCrowdPreviewCount(new URLSearchParams('crowdCount=50000'))).toBe(25_000);
    expect(resolveCrowdPreviewCount(new URLSearchParams('crowdCount=invalid'))).toBe(5_000);
    expect(clampCrowdCount(-12)).toBe(0);
    expect(clampCrowdCount(725.8)).toBe(725);
    expect(resolveCrowdPreviewCameraView('sideline')).toBe('sideline');
    expect(resolveCrowdPreviewCameraView('bad')).toBe('wide');
    expect(resolveCrowdBenchmarkDurationSeconds('0.01')).toBe(0.05);
    expect(resolveCrowdBenchmarkDurationSeconds('99')).toBe(10);
  });

  it('creates repeatable deterministic layouts with near and far LOD tiers', () => {
    const first = createCrowdPlacements(500);
    const second = createCrowdPlacements(500);

    expect(first).toEqual(second);
    expect(first).toHaveLength(500);
    expect(first.some((placement) => placement.lod === 'near')).toBe(true);
    expect(first.some((placement) => placement.lod === 'far')).toBe(true);
    expect(new Set(first.map((placement) => placement.stand))).toEqual(new Set([
      'endZoneFar',
      'endZoneNear',
      'sidelineLeft',
      'sidelineRight',
    ]));
    expect(first.every((placement) => placement.row >= 0 && placement.seatIndex >= 0)).toBe(true);
  });

  it('distributes full crowd fullness across real unique stadium seats', () => {
    const placements = createCrowdPlacements(5000, { nearCount: 500 });
    const seatKeys = new Set(placements.map((placement) =>
      `${placement.stand}:${placement.tier}:${placement.row}:${placement.seatIndex}`));
    const sectionCounts = new Map<string, number>();

    for (const placement of placements) {
      sectionCounts.set(placement.stand, (sectionCounts.get(placement.stand) ?? 0) + 1);
    }

    expect(seatKeys.size).toBe(placements.length);
    expect(placements.filter((placement) => placement.lod === 'near')).toHaveLength(500);
    expect(placements.filter((placement) => placement.lod === 'far')).toHaveLength(4500);
    expect([...sectionCounts.values()].every((count) => count > 0)).toBe(true);
    expect(sectionCounts.size).toBeGreaterThanOrEqual(6);
    expect(placements).toEqual(createCrowdPlacements(5000, { nearCount: 500 }));
  });

  it('uses bounded instanced resources for twenty-five thousand visual spectators', () => {
    const controller = new CrowdPreviewController({
      height: 720,
      requestedCount: 25_000,
      width: 1280,
    });

    const snapshot = controller.getSnapshot();
    const sceneObjectCount = countObjects(controller.group);
    const instancedMeshCount = countInstancedMeshes(controller.group);

    expect(snapshot.requestedSpectatorCount).toBe(25_000);
    expect(snapshot.actualSpectatorCount).toBe(25_000);
    expect(snapshot.nearInstanceCount).toBe(2500);
    expect(snapshot.farInstanceCount).toBe(0);
    expect(snapshot.farMosaicSeatCount).toBe(22500);
    expect(snapshot.nearInstanceCount + snapshot.farMosaicSeatCount).toBe(25_000);
    expect(snapshot.crowdDrawCalls).toBe(5);
    expect(snapshot.geometryCount).toBe(4);
    expect(snapshot.materialCount).toBe(3);
    expect(snapshot.textureCount).toBe(0);
    expect(instancedMeshCount).toBe(4);
    expect(sceneObjectCount).toBeLessThan(20);
    expect(snapshot.perInstanceStorage).toMatchObject({
      colorBytes: 12,
      customReactionDataBytes: 0,
      farMeshesPerSpectator: 0,
      nearMeshesPerSpectator: 4,
      transformMatrixBytes: 64,
    });
    expect(snapshot.estimatedInstanceBufferBytes).toBe(
      2500 * 4 * (64 + 12),
    );
    expect(snapshot.estimatedStaticBufferBytes).toBe(22500 * (12 + 12));
    expect(snapshot.gameplayPlayerCount).toBe(0);

    controller.dispose();
  });

  it('records benchmark reports using supplied frame deltas', () => {
    const renderer = {
      info: {
        memory: { geometries: 7, textures: 0 },
        render: { calls: 12, triangles: 1234 },
      },
    } as THREE.WebGLRenderer;
    const controller = new CrowdPreviewController({
      benchmarkDurationSeconds: 0.05,
      benchmarkEnabled: true,
      height: 720,
      requestedCount: 500,
      width: 1280,
    });

    for (let frame = 0; frame < 40; frame += 1) {
      controller.updateBeforeRender();
      controller.recordFrame(1 / 60, renderer);
    }

    const snapshot = controller.getSnapshot();
    expect(snapshot.benchmark.completed).toBe(true);
    expect(snapshot.benchmark.reports).toHaveLength(3);
    expect(snapshot.benchmark.reports.map((report) => report.actualSpectatorCount)).toEqual([
      5000,
      15_000,
      25_000,
    ]);
    expect(snapshot.benchmark.reports.every((report) => report.crowdDrawCalls === 5)).toBe(true);
    expect(snapshot.benchmark.reports[2].crowdTriangles).toBeLessThan(230000);
    expect(snapshot.benchmark.reports[0]).toMatchObject({
      actualSpectatorCount: 5000,
      requestedSpectatorCount: 5000,
      rendererMemory: { geometries: 7, textures: 0 },
    });

    controller.dispose();
  });

  it('disposes only owned crowd preview geometry and materials', () => {
    const controller = new CrowdPreviewController({
      height: 720,
      requestedCount: 2000,
      width: 1280,
    });
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();

    controller.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) {
        return;
      }

      geometries.add(object.geometry);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of objectMaterials) {
        materials.add(material);
      }
    });

    const geometrySpies = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialSpies = [...materials].map((material) => vi.spyOn(material, 'dispose'));

    controller.dispose();

    expect(geometrySpies).toHaveLength(4);
    expect(materialSpies).toHaveLength(3);
    expect(geometrySpies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    expect(materialSpies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
  });
});

function countObjects(root: THREE.Object3D): number {
  let count = 0;
  root.traverse(() => {
    count += 1;
  });
  return count;
}

function countInstancedMeshes(root: THREE.Object3D): number {
  let count = 0;
  root.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) {
      count += 1;
    }
  });
  return count;
}
