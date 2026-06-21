import {
  PERFORMANCE_FRAME_THRESHOLDS_MS,
  PERFORMANCE_PHASE_INDEX,
  PERFORMANCE_PHASES,
  type PerformancePhase,
} from './PerformanceBudget';
import type {
  LongFrameRecord,
  PerformanceProfilerSnapshot,
} from './FramePerformanceProfiler';
import type {
  RendererPerformanceMetrics,
  SceneStructureMetrics,
} from './RendererMetricsCollector';

export interface PercentileSummary {
  average: number;
  maximum: number;
  median: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface FrameRateSummary extends PercentileSummary {
  framesOver16_67Ms: number;
  framesOver18_18Ms: number;
  framesOver25Ms: number;
  framesOver33_33Ms: number;
  minimumRollingOneSecondFps: number;
  sampleCount: number;
}

export interface PhasePerformanceSummary extends PercentileSummary {
  displayName: string;
  id: PerformancePhase;
  sampleCount: number;
}

export interface BottleneckEvidence {
  averageMs: number;
  category:
    | 'crowd-related'
    | 'intermittent-spike'
    | 'presentation-event'
    | 'renderer-related'
    | 'simulation-related'
    | 'startup-only'
    | 'sustained-cost';
  evidence: string;
  phase: PerformancePhase;
  p95Ms: number;
}

export interface LongFrameCorrelationSummary {
  count: number;
  phaseHitCounts: Partial<Record<PerformancePhase, number>>;
  scenarioHitCounts: Record<string, number>;
  samples: LongFrameRecord[];
}

export interface PerformanceReportEnvironment {
  deviceScaleFactor: number;
  hardwareConcurrency: number | null;
  hiddenFrameCount: number;
  rendererDescription: string;
  softwareRendering: boolean;
  userAgent: string;
  viewport: {
    height: number;
    width: number;
  };
}

export interface PerformanceReportInput {
  activeScenario: string;
  environment: PerformanceReportEnvironment;
  renderer: RendererPerformanceMetrics;
  scene: SceneStructureMetrics;
  snapshot: PerformanceProfilerSnapshot;
}

export interface PerformanceReport {
  activeScenario: string;
  bottlenecks: BottleneckEvidence[];
  classification: {
    cpuBoundLikely: boolean;
    gpuBoundLikely: boolean;
    reason: string;
    timingAuthoritative: boolean;
  };
  environment: PerformanceReportEnvironment;
  frame: FrameRateSummary;
  longFrames: LongFrameCorrelationSummary;
  phasePercentiles: Record<PerformancePhase, PhasePerformanceSummary>;
  renderer: RendererPerformanceMetrics;
  scene: SceneStructureMetrics;
  summaryText: string;
}

export function createPerformanceReport(input: PerformanceReportInput): PerformanceReport {
  const frameDurations = input.snapshot.buffer.getFrameDurations();
  const timestamps = input.snapshot.buffer.getTimestamps();
  const frame = createFrameRateSummary(frameDurations, timestamps);
  const phasePercentiles = createPhaseSummaries(input.snapshot);
  const longFrames = summarizeLongFrames(input.snapshot.longFrames);
  const bottlenecks = createBottleneckEvidence(phasePercentiles, input.renderer, longFrames);
  const classification = classifyPerformance(phasePercentiles, input.renderer, input.environment);
  const reportWithoutSummary = {
    activeScenario: input.activeScenario,
    bottlenecks,
    classification,
    environment: input.environment,
    frame,
    longFrames,
    phasePercentiles,
    renderer: input.renderer,
    scene: input.scene,
  };

  return {
    ...reportWithoutSummary,
    summaryText: createReadableSummary(reportWithoutSummary),
  };
}

export function createFrameRateSummary(
  frameDurations: readonly number[],
  timestampsMs: readonly number[],
): FrameRateSummary {
  const base = summarizeValues(frameDurations);

  return {
    ...base,
    framesOver16_67Ms: countOver(frameDurations, PERFORMANCE_FRAME_THRESHOLDS_MS.target60Fps),
    framesOver18_18Ms: countOver(frameDurations, PERFORMANCE_FRAME_THRESHOLDS_MS.target55Fps),
    framesOver25Ms: countOver(frameDurations, PERFORMANCE_FRAME_THRESHOLDS_MS.noticeableFrame),
    framesOver33_33Ms: countOver(frameDurations, PERFORMANCE_FRAME_THRESHOLDS_MS.longFrame),
    minimumRollingOneSecondFps: calculateMinimumRollingFps(timestampsMs),
    sampleCount: frameDurations.length,
  };
}

export function summarizeValues(values: readonly number[]): PercentileSummary {
  const finiteValues = values.filter((value) => Number.isFinite(value) && value >= 0);

  return {
    average: average(finiteValues),
    maximum: finiteValues.length > 0 ? Math.max(...finiteValues) : 0,
    median: percentile(finiteValues, 50),
    p90: percentile(finiteValues, 90),
    p95: percentile(finiteValues, 95),
    p99: percentile(finiteValues, 99),
  };
}

function createPhaseSummaries(
  snapshot: PerformanceProfilerSnapshot,
): Record<PerformancePhase, PhasePerformanceSummary> {
  return Object.fromEntries(
    PERFORMANCE_PHASES.map((phase, phaseIndex) => {
      const values = snapshot.buffer.getPhaseDurations(phaseIndex);
      return [
        phase.id,
        {
          ...summarizeValues(values),
          displayName: phase.displayName,
          id: phase.id,
          sampleCount: values.length,
        },
      ];
    }),
  ) as Record<PerformancePhase, PhasePerformanceSummary>;
}

function createBottleneckEvidence(
  phasePercentiles: Record<PerformancePhase, PhasePerformanceSummary>,
  renderer: RendererPerformanceMetrics,
  longFrames: LongFrameCorrelationSummary,
): BottleneckEvidence[] {
  return PERFORMANCE_PHASES
    .filter((phase) => phase.id !== 'unclassifiedFrameTime')
    .map((phase) => {
      const summary = phasePercentiles[phase.id];
      return {
        averageMs: summary.average,
        category: categorizePhase(phase.id, summary, longFrames),
        evidence: createPhaseEvidence(phase.id, summary, renderer, longFrames),
        p95Ms: summary.p95,
        phase: phase.id,
      };
    })
    .sort((a, b) => b.averageMs - a.averageMs || b.p95Ms - a.p95Ms)
    .slice(0, 5);
}

function summarizeLongFrames(longFrames: readonly LongFrameRecord[]): LongFrameCorrelationSummary {
  const phaseHitCounts: Partial<Record<PerformancePhase, number>> = {};
  const scenarioHitCounts: Record<string, number> = {};

  for (const frame of longFrames) {
    scenarioHitCounts[frame.context.activeScenario] =
      (scenarioHitCounts[frame.context.activeScenario] ?? 0) + 1;
    const highestPhase = findHighestPhase(frame.phaseTimingsMs);
    phaseHitCounts[highestPhase] = (phaseHitCounts[highestPhase] ?? 0) + 1;
  }

  return {
    count: longFrames.length,
    phaseHitCounts,
    scenarioHitCounts,
    samples: longFrames.slice(0, 24),
  };
}

function classifyPerformance(
  phasePercentiles: Record<PerformancePhase, PhasePerformanceSummary>,
  renderer: RendererPerformanceMetrics,
  environment: PerformanceReportEnvironment,
): PerformanceReport['classification'] {
  const renderAverage = phasePercentiles.rendererRender.average;
  const simulationAverage =
    phasePercentiles.gameplayStateUpdate.average +
    phasePercentiles.offensiveAssignments.average +
    phasePercentiles.defensiveAi.average +
    phasePercentiles.playerCollisionSeparation.average;
  const presentationAverage =
    phasePercentiles.cameraUpdate.average +
    phasePercentiles.proceduralPlayerPosing.average +
    phasePercentiles.crowdBehaviorUpdate.average +
    phasePercentiles.crowdInstanceUpdates.average +
    phasePercentiles.audioUpdate.average;
  const gpuBoundLikely = renderAverage >= simulationAverage && renderer.calls > 300;
  const cpuBoundLikely = !gpuBoundLikely && simulationAverage + presentationAverage >= renderAverage;

  return {
    cpuBoundLikely,
    gpuBoundLikely,
    reason: environment.softwareRendering
      ? 'Renderer is software-rendered, so timing is informational.'
      : gpuBoundLikely
        ? 'renderer.render is the largest sustained phase and draw calls are high.'
        : 'Measured CPU-side simulation and presentation phases dominate renderer.render.',
    timingAuthoritative: !environment.softwareRendering,
  };
}

function createReadableSummary(
  report: Omit<PerformanceReport, 'summaryText'>,
): string {
  const topBottlenecks = report.bottlenecks
    .map((entry, index) =>
      `${index + 1}. ${entry.phase}: avg ${entry.averageMs.toFixed(2)} ms, ` +
      `p95 ${entry.p95Ms.toFixed(2)} ms (${entry.category})`)
    .join('\n');

  return [
    `Scenario: ${report.activeScenario}`,
    `Renderer: ${report.environment.rendererDescription}`,
    `Frame median ${report.frame.median.toFixed(2)} ms, p95 ${report.frame.p95.toFixed(2)} ms, ` +
      `p99 ${report.frame.p99.toFixed(2)} ms, min rolling FPS ${report.frame.minimumRollingOneSecondFps.toFixed(1)}.`,
    `Render calls ${report.renderer.calls}, triangles ${report.renderer.triangles}, ` +
      `geometries ${report.renderer.geometries}, textures ${report.renderer.textures}.`,
    `Scene objects ${report.scene.object3DCount}, visible meshes ${report.scene.visibleMeshCount}, ` +
      `player meshes ${report.scene.playerMeshCount}, crowd instances ${report.scene.crowdInstanceCount}.`,
    `Classification: ${report.classification.reason}`,
    `Top measured bottlenecks:\n${topBottlenecks}`,
  ].join('\n');
}

function categorizePhase(
  phase: PerformancePhase,
  summary: PhasePerformanceSummary,
  longFrames: LongFrameCorrelationSummary,
): BottleneckEvidence['category'] {
  if (phase === 'rendererRender') {
    return 'renderer-related';
  }
  if (phase === 'crowdBehaviorUpdate' || phase === 'crowdInstanceUpdates') {
    return 'crowd-related';
  }
  if (phase === 'presentationEventProcessing' || phase === 'audioUpdate' || phase === 'cameraUpdate') {
    return 'presentation-event';
  }
  if (
    phase === 'gameplayStateUpdate' ||
    phase === 'offensiveAssignments' ||
    phase === 'defensiveAi' ||
    phase === 'blockingAndEngagement' ||
    phase === 'playerCollisionSeparation' ||
    phase === 'receiverRouteUpdates' ||
    phase === 'passTargetingAndBallSimulation'
  ) {
    return 'simulation-related';
  }
  if ((longFrames.phaseHitCounts[phase] ?? 0) > 0 && summary.p99 > summary.p95 * 1.5) {
    return 'intermittent-spike';
  }
  return 'sustained-cost';
}

function createPhaseEvidence(
  phase: PerformancePhase,
  summary: PhasePerformanceSummary,
  renderer: RendererPerformanceMetrics,
  longFrames: LongFrameCorrelationSummary,
): string {
  const longFrameHits = longFrames.phaseHitCounts[phase] ?? 0;
  const renderContext = phase === 'rendererRender'
    ? ` Renderer counters: ${renderer.calls} calls, ${renderer.triangles} triangles.`
    : '';
  return `${summary.displayName} averaged ${summary.average.toFixed(2)} ms with p95 ` +
    `${summary.p95.toFixed(2)} ms and led ${longFrameHits} retained long frames.${renderContext}`;
}

function findHighestPhase(phaseTimingsMs: Record<PerformancePhase, number>): PerformancePhase {
  let highestPhase = PERFORMANCE_PHASES[0].id;
  let highestDuration = Number.NEGATIVE_INFINITY;

  for (const phase of PERFORMANCE_PHASES) {
    const duration = phaseTimingsMs[phase.id] ?? 0;
    if (duration > highestDuration) {
      highestPhase = phase.id;
      highestDuration = duration;
    }
  }

  return highestPhase;
}

function calculateMinimumRollingFps(timestampsMs: readonly number[]): number {
  if (timestampsMs.length < 2) {
    return 0;
  }

  const firstTimestamp = timestampsMs[0];
  const normalizedTimestamps = timestampsMs.map((timestamp) => timestamp - firstTimestamp);
  const rollingFps: number[] = [];
  let startIndex = 0;

  for (let endIndex = 0; endIndex < normalizedTimestamps.length; endIndex += 1) {
    const endTime = normalizedTimestamps[endIndex];
    while (normalizedTimestamps[startIndex] < endTime - 1_000) {
      startIndex += 1;
    }
    if (endTime >= 1_000) {
      rollingFps.push((endIndex - startIndex + 1) * 1_000 / 1_000);
    }
  }

  return rollingFps.length > 0 ? Math.min(...rollingFps) : 0;
}

function countOver(values: readonly number[], threshold: number): number {
  return values.filter((value) => value > threshold).length;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = values.slice().sort((a, b) => a - b);
  const index = percentileValue / 100 * (sorted.length - 1);
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  const weight = index - lowerIndex;
  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
}
