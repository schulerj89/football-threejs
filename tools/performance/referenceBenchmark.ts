export interface FrameSample {
  frameTimesMs: number[];
  hiddenFrameCount: number;
  sampleDurationMs: number;
  timestampsMs: number[];
}

export interface FrameTimingSummary {
  belowTargetRollingWindowCount: number;
  frameCount: number;
  maxFrameTimeMs: number;
  medianFrameTimeMs: number;
  minRollingFps: number;
  p95FrameTimeMs: number;
  p99FrameTimeMs: number;
  sampleDurationMs: number;
}

export interface RendererClassification {
  rendererDescription: string;
  softwareRendering: boolean;
}

export const REFERENCE_BENCHMARK_CONFIG = {
  sampleDurationMs: 12_000,
  viewport: {
    deviceScaleFactor: 1,
    height: 1080,
    width: 1920,
  },
  warmupMs: 3_000,
} as const;

export const REFERENCE_TIMING_TARGETS = {
  medianFrameTimeMs: 16.67,
  minRollingFps: 55,
  p95FrameTimeMs: 18.18,
  p99FrameTimeMs: 33.33,
} as const;

export const REFERENCE_TIMING_MEASUREMENT_EPSILON_MS = 0.05;

export const REFERENCE_STRUCTURAL_BUDGETS = {
  crowdSpectatorCount: 25_000,
  maxCrowdDrawCalls: 8,
  maxDrawCalls: 450,
  maxGeometries: 200,
  maxMaterials: 90,
  maxShadowCasters: 0,
  maxStadiumDrawCalls: 20,
  maxTextures: 32,
  maxTriangles: 250_000,
  maxVisiblePlayerMeshes: 390,
  playerCount: 22,
} as const;

export function summarizeFrameSample(sample: FrameSample): FrameTimingSummary {
  const frameTimesMs = sample.frameTimesMs.filter((value) => Number.isFinite(value) && value >= 0);
  const maxFrameTimeMs = frameTimesMs.length > 0 ? Math.max(...frameTimesMs) : 0;
  const rollingFps = calculateRollingFps(sample.timestampsMs, 1_000);
  const belowTargetRollingWindowCount = rollingFps.filter((fps) =>
    fps < REFERENCE_TIMING_TARGETS.minRollingFps
  ).length;
  return {
    belowTargetRollingWindowCount,
    frameCount: frameTimesMs.length,
    maxFrameTimeMs,
    medianFrameTimeMs: percentile(frameTimesMs, 50),
    minRollingFps: rollingFps.length > 0 ? Math.min(...rollingFps) : 0,
    p95FrameTimeMs: percentile(frameTimesMs, 95),
    p99FrameTimeMs: percentile(frameTimesMs, 99),
    sampleDurationMs: sample.sampleDurationMs,
  };
}

export function calculateRollingFps(timestampsMs: readonly number[], windowMs: number): number[] {
  if (windowMs <= 0 || timestampsMs.length < 2) {
    return [];
  }

  const sortedTimestamps = timestampsMs
    .filter((value) => Number.isFinite(value) && value >= 0)
    .slice()
    .sort((a, b) => a - b);
  const rollingFps: number[] = [];
  let startIndex = 0;

  for (let endIndex = 0; endIndex < sortedTimestamps.length; endIndex += 1) {
    const endTime = sortedTimestamps[endIndex];
    while (sortedTimestamps[startIndex] < endTime - windowMs) {
      startIndex += 1;
    }

    if (endTime >= windowMs) {
      const frameCount = endIndex - startIndex + 1;
      rollingFps.push((frameCount * 1_000) / windowMs);
    }
  }

  return rollingFps;
}

export function classifyRenderer(rendererDescription: string): RendererClassification {
  return {
    rendererDescription,
    softwareRendering: isSoftwareRenderer(rendererDescription),
  };
}

export function passesReferenceTiming(summary: FrameTimingSummary): boolean {
  const medianTarget = REFERENCE_TIMING_TARGETS.medianFrameTimeMs +
    REFERENCE_TIMING_MEASUREMENT_EPSILON_MS;
  const p95Target = REFERENCE_TIMING_TARGETS.p95FrameTimeMs +
    REFERENCE_TIMING_MEASUREMENT_EPSILON_MS;
  const p99Target = REFERENCE_TIMING_TARGETS.p99FrameTimeMs +
    REFERENCE_TIMING_MEASUREMENT_EPSILON_MS;

  return summary.medianFrameTimeMs <= medianTarget &&
    summary.p95FrameTimeMs <= p95Target &&
    summary.p99FrameTimeMs <= p99Target &&
    summary.minRollingFps >= REFERENCE_TIMING_TARGETS.minRollingFps;
}

export function passesSmokeTimingTolerance(summary: FrameTimingSummary): boolean {
  return summary.minRollingFps >= REFERENCE_TIMING_TARGETS.minRollingFps &&
    summary.belowTargetRollingWindowCount === 0;
}

function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = values.slice().sort((a, b) => a - b);
  const index = (percentileValue / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  const weight = index - lowerIndex;
  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
}

function isSoftwareRenderer(rendererDescription: string): boolean {
  return /swiftshader|software|llvmpipe|microsoft basic render|warp|mesa offscreen/i
    .test(rendererDescription);
}
