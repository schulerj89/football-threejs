import { describe, expect, it } from 'vitest';
import { FramePerformanceProfiler } from '../src/performance/FramePerformanceProfiler';
import { FrameSampleBuffer } from '../src/performance/FrameSampleBuffer';
import {
  createFrameRateSummary,
  createPerformanceReport,
} from '../src/performance/PerformanceReport';
import { PerformanceScenarioRunner } from '../src/performance/PerformanceScenarioRunner';
import { createGameplayModel } from '../src/playState';

describe('performance profiling foundation', () => {
  it('stores frame samples in a preallocated ring buffer', () => {
    const buffer = new FrameSampleBuffer(3, 2);
    const phases = new Float64Array([1, 2]);

    buffer.recordFrame(0, 16, phases);
    buffer.recordFrame(16, 17, phases);
    buffer.recordFrame(33, 18, phases);
    buffer.recordFrame(51, 19, phases);

    expect(buffer.getCount()).toBe(3);
    expect(buffer.getTotalRecorded()).toBe(4);
    expect(buffer.getFrameDurations()).toEqual([17, 18, 19]);
    expect(buffer.getPhaseDurations(0)).toEqual([1, 1, 1]);
  });

  it('records nested phase timings without double-counting child work', () => {
    const profiler = new FramePerformanceProfiler(true, 8);

    profiler.beginFrame(0);
    profiler.startPhase('gameplayStateUpdate', 0);
    profiler.startPhase('defensiveAi', 2);
    profiler.endPhase('defensiveAi', 7);
    profiler.endPhase('gameplayStateUpdate', 10);
    profiler.endFrame(16, createFrameContext(), createRendererMetrics(), createSceneMetrics());

    const snapshot = profiler.getSnapshot();
    expect(snapshot.buffer.getFrameDurations()).toEqual([16]);
    expect(snapshot.buffer.getPhaseDurations(1)).toEqual([5]);
    expect(snapshot.buffer.getPhaseDurations(4)).toEqual([5]);
  });

  it('creates a report with frame, phase, and bottleneck summaries', () => {
    const profiler = new FramePerformanceProfiler(true, 8);

    for (let frame = 0; frame < 5; frame += 1) {
      const start = frame * 20;
      profiler.beginFrame(start);
      profiler.startPhase('rendererRender', start);
      profiler.endPhase('rendererRender', start + 12);
      profiler.endFrame(start + 20, createFrameContext(), createRendererMetrics(), createSceneMetrics());
    }

    const report = createPerformanceReport({
      activeScenario: 'eleven-presnap',
      environment: {
        deviceScaleFactor: 1,
        hardwareConcurrency: 8,
        hiddenFrameCount: 0,
        rendererDescription: 'ANGLE hardware',
        softwareRendering: false,
        userAgent: 'vitest',
        viewport: { height: 1080, width: 1920 },
      },
      renderer: createRendererMetrics(),
      scene: createSceneMetrics(),
      snapshot: profiler.getSnapshot(),
    });

    expect(report.frame.sampleCount).toBe(5);
    expect(report.phasePercentiles.rendererRender.average).toBe(12);
    expect(report.bottlenecks[0].phase).toBe('rendererRender');
    expect(report.longFrames.count).toBeGreaterThan(0);
  });

  it('calculates rolling FPS from absolute browser timestamps', () => {
    const timestamps = Array.from(
      { length: 121 },
      (_, index) => 10_000 + index * (1_000 / 60),
    );
    const frameDurations = timestamps.slice(1).map((timestamp, index) => timestamp - timestamps[index]);
    const summary = createFrameRateSummary(frameDurations, timestamps);

    expect(summary.minimumRollingOneSecondFps).toBeGreaterThanOrEqual(59);
  });

  it('sets deterministic 11v11 scenarios without changing the default model contract', () => {
    const gameplay = createGameplayModel({ playbookId: '11v11' });
    const runner = new PerformanceScenarioRunner(() => gameplay);

    runner.setScenario('eleven-pass-routes');

    expect(gameplay.playbookId).toBe('11v11');
    expect(gameplay.players).toHaveLength(22);
    expect(gameplay.selectedPlay.id).toBe('spread-quick-11');
    expect(gameplay.playState).toBe('live');
    expect(runner.getSnapshot().activeScenario).toBe('eleven-pass-routes');
  });
});

function createFrameContext() {
  return {
    activeScenario: 'eleven-presnap',
    activeShot: null,
    cameraState: 'preSnap',
    crowdCount: 500,
    crowdReactionBegan: false,
    playState: 'preSnap',
    playerCount: 22,
    presentationState: 'preSnapEstablish',
    resourceCreatedOrDisposed: false,
  };
}

function createRendererMetrics() {
  return {
    calls: 376,
    geometries: 141,
    lines: 0,
    points: 0,
    textures: 1,
    triangles: 194_500,
  };
}

function createSceneMetrics() {
  return {
    crowdInstanceCount: 500,
    helmetCount: 22,
    lightCount: 2,
    materialCount: 59,
    object3DCount: 420,
    officialMeshCount: 0,
    playerMeshCount: 352,
    shadowCastingObjectCount: 0,
    stadiumMeshCount: 1,
    visibleMeshCount: 382,
  };
}
