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
    expect(resolveCrowdPreviewCount(new URLSearchParams('crowdCount=50000'))).toBe(10_000);
    expect(resolveCrowdPreviewCount(new URLSearchParams('crowdCount=invalid'))).toBe(500);
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
  });

  it('uses bounded instanced resources for ten thousand spectators', () => {
    const controller = new CrowdPreviewController({
      height: 720,
      requestedCount: 10_000,
      width: 1280,
    });

    const snapshot = controller.getSnapshot();
    const sceneObjectCount = countObjects(controller.group);
    const instancedMeshCount = countInstancedMeshes(controller.group);

    expect(snapshot.requestedSpectatorCount).toBe(10_000);
    expect(snapshot.actualSpectatorCount).toBe(10_000);
    expect(snapshot.nearInstanceCount).toBe(2500);
    expect(snapshot.farInstanceCount).toBe(7500);
    expect(snapshot.nearInstanceCount + snapshot.farInstanceCount).toBe(10_000);
    expect(snapshot.crowdDrawCalls).toBe(6);
    expect(snapshot.geometryCount).toBe(5);
    expect(snapshot.materialCount).toBe(4);
    expect(snapshot.textureCount).toBe(0);
    expect(instancedMeshCount).toBe(5);
    expect(sceneObjectCount).toBeLessThan(20);
    expect(snapshot.perInstanceStorage).toMatchObject({
      colorBytes: 12,
      customReactionDataBytes: 0,
      farMeshesPerSpectator: 1,
      nearMeshesPerSpectator: 4,
      transformMatrixBytes: 64,
    });
    expect(snapshot.estimatedInstanceBufferBytes).toBe(
      2500 * 4 * (64 + 12) + 7500 * (64 + 12),
    );
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
    expect(snapshot.benchmark.reports).toHaveLength(4);
    expect(snapshot.benchmark.reports.map((report) => report.actualSpectatorCount)).toEqual([
      500,
      2000,
      5000,
      10_000,
    ]);
    expect(snapshot.benchmark.reports.every((report) => report.crowdDrawCalls === 6)).toBe(true);
    expect(snapshot.benchmark.reports[0]).toMatchObject({
      actualSpectatorCount: 500,
      requestedSpectatorCount: 500,
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
      if (!(object instanceof THREE.Mesh)) {
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

    expect(geometrySpies).toHaveLength(5);
    expect(materialSpies).toHaveLength(4);
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
