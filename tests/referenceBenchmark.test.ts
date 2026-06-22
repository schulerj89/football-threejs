import { describe, expect, it } from 'vitest';
import {
  calculateRollingFps,
  classifyRenderer,
  passesReferenceTiming,
  passesSmokeTimingTolerance,
  REFERENCE_STRUCTURAL_BUDGETS,
  summarizeFrameSample,
  type FrameSample,
} from '../tools/performance/referenceBenchmark';
import { PERFORMANCE_STRUCTURAL_BUDGETS } from '../src/performance/PerformanceBudget';

describe('reference performance benchmark helpers', () => {
  it('summarizes frame timing percentiles and rolling FPS', () => {
    const sample = createConstantFrameSample(60, 12_000);
    const summary = summarizeFrameSample(sample);

    expect(summary.frameCount).toBeGreaterThan(700);
    expect(summary.medianFrameTimeMs).toBeCloseTo(16.67, 1);
    expect(summary.p95FrameTimeMs).toBeCloseTo(16.67, 1);
    expect(summary.p99FrameTimeMs).toBeCloseTo(16.67, 1);
    expect(summary.minRollingFps).toBeGreaterThanOrEqual(59);
    expect(summary.belowTargetRollingWindowCount).toBe(0);
    expect(passesReferenceTiming(summary)).toBe(true);
    expect(passesSmokeTimingTolerance(summary)).toBe(true);
  });

  it('detects rolling one-second windows below the smoke FPS floor', () => {
    const sample = createConstantFrameSample(50, 12_000);
    const summary = summarizeFrameSample(sample);

    expect(summary.minRollingFps).toBeLessThan(55);
    expect(summary.belowTargetRollingWindowCount).toBeGreaterThan(0);
    expect(passesReferenceTiming(summary)).toBe(false);
    expect(passesSmokeTimingTolerance(summary)).toBe(false);
  });

  it('allows exact 60Hz timestamp rounding within the primary measurement epsilon', () => {
    const sample = createConstantFrameSample(59.88, 12_000);
    const summary = summarizeFrameSample(sample);

    expect(summary.medianFrameTimeMs).toBeGreaterThan(16.67);
    expect(passesReferenceTiming(summary)).toBe(true);
    expect(passesSmokeTimingTolerance(summary)).toBe(true);
  });

  it('calculates rolling FPS from timestamp windows', () => {
    const timestamps = Array.from({ length: 121 }, (_, index) => index * (1_000 / 60));
    const rollingFps = calculateRollingFps(timestamps, 1_000);

    expect(Math.min(...rollingFps)).toBeGreaterThanOrEqual(59);
    expect(Math.max(...rollingFps)).toBeLessThanOrEqual(61);
  });

  it('classifies SwiftShader and hardware renderer descriptions', () => {
    expect(classifyRenderer('Google SwiftShader').softwareRendering).toBe(true);
    expect(classifyRenderer('ANGLE (NVIDIA GeForce RTX 4070 Direct3D11)').softwareRendering).toBe(false);
  });

  it('keeps reference structural budgets aligned with the runtime performance profile', () => {
    expect(REFERENCE_STRUCTURAL_BUDGETS).toEqual(PERFORMANCE_STRUCTURAL_BUDGETS);
  });
});

function createConstantFrameSample(fps: number, durationMs: number): FrameSample {
  const frameTimeMs = 1_000 / fps;
  const frameCount = Math.floor(durationMs / frameTimeMs);
  const timestampsMs = Array.from({ length: frameCount }, (_, index) => index * frameTimeMs);
  return {
    frameTimesMs: timestampsMs.slice(1).map((timestamp, index) => timestamp - timestampsMs[index]),
    hiddenFrameCount: 0,
    sampleDurationMs: durationMs,
    timestampsMs,
  };
}
