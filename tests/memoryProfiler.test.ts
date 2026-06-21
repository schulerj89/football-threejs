import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BrowserMemoryProvider } from '../src/performance/BrowserMemoryProvider';
import {
  CrowdCapacityBenchmark,
  calculatePercentile,
  resolveCrowdDensityForRecommendedCount,
} from '../src/performance/CrowdCapacityBenchmark';
import {
  estimateGeometryBufferBytes,
  estimateInstancedMeshBufferBytes,
} from '../src/performance/GeometryMemoryEstimator';
import {
  createSceneResourceProfileSnapshot,
} from '../src/performance/SceneResourceProfiler';
import {
  estimateTextureMemory,
} from '../src/performance/TextureMemoryEstimator';
import type { CrowdCapacityCrowdOwner } from '../src/performance/CrowdCapacityBenchmark';
import type { SceneResourceProfileSnapshot } from '../src/performance/MemoryTypes';

describe('runtime memory profiler', () => {
  it('calculates buffer attribute and index bytes for known geometry', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3),
    );
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2]), 1));

    const estimate = estimateGeometryBufferBytes(geometry);

    expect(estimate.attributeBytes).toBe(9 * Float32Array.BYTES_PER_ELEMENT);
    expect(estimate.geometryIndexBytes).toBe(3 * Uint16Array.BYTES_PER_ELEMENT);
    expect(estimate.totalBytes).toBe(42);
  });

  it('calculates instance matrix and color bytes', () => {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
      2,
    );
    mesh.setColorAt(0, new THREE.Color(0xffffff));
    mesh.setColorAt(1, new THREE.Color(0x000000));

    const estimate = estimateInstancedMeshBufferBytes(mesh);

    expect(estimate.instanceMatrixBytes).toBe(2 * 16 * Float32Array.BYTES_PER_ELEMENT);
    expect(estimate.instanceColorBytes).toBe(2 * 3 * Float32Array.BYTES_PER_ELEMENT);
  });

  it('estimates simple texture bytes and labels unknown APIs honestly', async () => {
    const texture = new THREE.DataTexture(
      new Uint8Array(4 * 4 * 4),
      4,
      4,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    texture.generateMipmaps = false;

    const estimate = estimateTextureMemory(texture);
    const browserMemory = await new BrowserMemoryProvider({}).measure();

    expect(estimate.estimatedBytes).toBe(4 * 4 * 4);
    expect(browserMemory.measureUserAgentSpecificMemory.supported).toBe(false);
    expect(browserMemory.performanceMemory.supported).toBe(false);
    expect(browserMemory.deviceMemory.supported).toBe(false);
  });

  it('groups scene resources by visible subsystem ownership', () => {
    const scene = new THREE.Scene();
    const field = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    field.name = 'football-field';
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 4, 4), new THREE.MeshBasicMaterial());
    ball.name = 'football-ball';
    const officials = new THREE.Group();
    officials.name = 'officials-presentation-root';
    officials.userData.officialsPresentation = true;
    officials.add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1, 5), new THREE.MeshBasicMaterial()),
    );
    scene.add(field, ball, officials);

    const profile = createSceneResourceProfileSnapshot({
      renderer: createFakeRenderer(),
      scene,
    });

    const fieldTotal = profile.subsystemTotals.find((entry) => entry.subsystem === 'field');
    const footballTotal = profile.subsystemTotals.find((entry) => entry.subsystem === 'football');
    const officialsTotal = profile.subsystemTotals.find((entry) => entry.subsystem === 'officials');
    expect(fieldTotal?.meshCount).toBe(1);
    expect(footballTotal?.meshCount).toBe(1);
    expect(officialsTotal?.meshCount).toBe(1);
    expect(profile.disclaimer).toContain('not exact GPU VRAM');
  });
});

describe('crowd capacity benchmark', () => {
  it('calculates deterministic percentiles', () => {
    expect(calculatePercentile([16, 12, 24, 20], 95)).toBe(24);
  });

  it('cancels active trials and disposes temporary crowd resources', () => {
    const scene = new THREE.Scene();
    let disposed = 0;
    const benchmark = new CrowdCapacityBenchmark({
      candidateCounts: [500],
      createCrowdResourceOwner: (count) => createFakeCrowdOwner(count, () => {
        disposed += 1;
      }),
      createProfile: () => createFakeProfile(0),
      scene,
      warmupSeconds: 0,
    });

    benchmark.start();
    expect(scene.children).toHaveLength(1);
    benchmark.cancel();

    expect(disposed).toBe(1);
    expect(scene.children).toHaveLength(0);
    expect(benchmark.getSnapshot().status).toBe('cancelled');
  });

  it('does not accumulate resources across repeated benchmark runs', () => {
    const scene = new THREE.Scene();
    let activeCount = 0;
    let disposed = 0;
    const benchmark = new CrowdCapacityBenchmark({
      candidateCounts: [0, 500],
      createCrowdResourceOwner: (count) => {
        activeCount = count;
        return createFakeCrowdOwner(count, () => {
          activeCount = 0;
          disposed += 1;
        });
      },
      createProfile: () => createFakeProfile(activeCount * 64),
      scene,
      targetFrameTimeMs: 100,
      trialDurationSeconds: 0.02,
      warmupSeconds: 0,
    });

    benchmark.start();
    for (let frame = 0; frame < 10; frame += 1) {
      benchmark.update(1 / 60);
    }
    const firstReport = benchmark.exportReport();

    benchmark.start();
    for (let frame = 0; frame < 10; frame += 1) {
      benchmark.update(1 / 60);
    }
    const secondReport = benchmark.exportReport();

    expect(firstReport?.testedCounts.map((trial) => trial.requestedCount)).toEqual([0, 500]);
    expect(secondReport?.testedCounts.map((trial) => trial.requestedCount)).toEqual([0, 500]);
    expect(scene.children).toHaveLength(0);
    expect(disposed).toBeGreaterThanOrEqual(2);
  });

  it('maps session recommendation to normal crowd density presets', () => {
    expect(resolveCrowdDensityForRecommendedCount(0)).toBe('low');
    expect(resolveCrowdDensityForRecommendedCount(500)).toBe('low');
    expect(resolveCrowdDensityForRecommendedCount(2_500)).toBe('medium');
    expect(resolveCrowdDensityForRecommendedCount(10_000)).toBe('high');
  });
});

function createFakeRenderer(): THREE.WebGLRenderer {
  return {
    info: {
      memory: { geometries: 2, textures: 0 },
      render: { calls: 2, lines: 0, points: 0, triangles: 24 },
    },
  } as unknown as THREE.WebGLRenderer;
}

function createFakeProfile(bufferBytes: number): SceneResourceProfileSnapshot {
  return {
    browserMemory: {
      deviceMemory: { supported: false },
      measureUserAgentSpecificMemory: {
        label: 'unsupported',
        supported: false,
      },
      performanceMemory: { supported: false },
    },
    calculatedBufferBytes: {
      attributeBytes: bufferBytes,
      customInstanceAttributeBytes: 0,
      geometryIndexBytes: 0,
      instanceColorBytes: 0,
      instanceMatrixBytes: 0,
      morphAttributeBytes: 0,
      totalBytes: bufferBytes,
    },
    disclaimer: 'test',
    renderer: {
      drawCalls: bufferBytes > 0 ? 6 : 0,
      geometries: bufferBytes > 0 ? 5 : 0,
      lines: 0,
      points: 0,
      textures: 0,
      triangles: bufferBytes,
    },
    subsystemTotals: [],
    textureEstimates: [],
    totals: {
      estimatedTextureBytes: 0,
      materialCount: 0,
      meshCount: 0,
      objectCount: 0,
      unknownTextureCount: 0,
    },
  };
}

function createFakeCrowdOwner(
  count: number,
  onDispose: () => void,
): CrowdCapacityCrowdOwner {
  const group = new THREE.Group();
  group.name = `fake-crowd-${count}`;
  return {
    dispose: onDispose,
    group,
    resources: {
      detailedArmLeft: null,
      detailedArmRight: null,
      detailedHead: null,
      detailedTorso: null,
      farBody: null,
      farPlacements: [],
      geometries: [],
      group,
      materials: [],
      nearPlacements: [],
      snapshotBase: {
        actualSpectatorCount: count,
        crowdDrawCalls: count > 0 ? 5 : 0,
        crowdTriangles: count * 10,
        estimatedInstanceBufferBytes: count * 64,
        farInstanceCount: 0,
        geometryCount: count > 0 ? 4 : 0,
        materialCount: count > 0 ? 3 : 0,
        nearInstanceCount: count,
        textureCount: 0,
      },
    } as unknown as CrowdCapacityCrowdOwner['resources'],
  };
}
