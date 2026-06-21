import {
  PERFORMANCE_FRAME_THRESHOLDS_MS,
  PERFORMANCE_PHASE_INDEX,
  PERFORMANCE_PHASES,
  PERFORMANCE_RING_BUFFER_CAPACITY,
  type PerformancePhase,
} from './PerformanceBudget';
import { FrameSampleBuffer } from './FrameSampleBuffer';
import type {
  RendererPerformanceMetrics,
  SceneStructureMetrics,
} from './RendererMetricsCollector';

export interface PerformanceFrameContext {
  activeScenario: string;
  activeShot: string | null;
  cameraState: string;
  crowdCount: number;
  crowdReactionBegan: boolean;
  playState: string;
  playerCount: number;
  presentationState: string;
  resourceCreatedOrDisposed: boolean;
}

export interface LongFrameRecord {
  context: PerformanceFrameContext;
  frameDurationMs: number;
  phaseTimingsMs: Record<PerformancePhase, number>;
  renderer: RendererPerformanceMetrics;
  scene: SceneStructureMetrics;
  timestampMs: number;
}

export interface PerformanceProfilerSnapshot {
  buffer: FrameSampleBuffer;
  enabled: boolean;
  longFrames: LongFrameRecord[];
  phaseNames: readonly PerformancePhase[];
  totalFramesRecorded: number;
}

const MAX_NESTED_PHASE_DEPTH = 32;
const MAX_LONG_FRAME_RECORDS = 96;

export class FramePerformanceProfiler {
  readonly enabled: boolean;

  private readonly buffer: FrameSampleBuffer;
  private readonly currentPhaseDurationsMs = new Float64Array(PERFORMANCE_PHASES.length);
  private readonly phaseStack = new Int16Array(MAX_NESTED_PHASE_DEPTH);
  private readonly phaseStartStack = new Float64Array(MAX_NESTED_PHASE_DEPTH);
  private readonly childDurationStack = new Float64Array(MAX_NESTED_PHASE_DEPTH);
  private readonly longFrames: LongFrameRecord[] = [];
  private frameStartMs = 0;
  private stackDepth = 0;

  constructor(enabled: boolean, capacity = PERFORMANCE_RING_BUFFER_CAPACITY) {
    this.enabled = enabled;
    this.buffer = new FrameSampleBuffer(capacity, PERFORMANCE_PHASES.length);
  }

  static createFromSearchParams(searchParams: URLSearchParams): FramePerformanceProfiler {
    return new FramePerformanceProfiler(searchParams.get('perfProfile') === '1');
  }

  beginFrame(timestampMs: number): void {
    if (!this.enabled) {
      return;
    }

    this.frameStartMs = timestampMs;
    this.stackDepth = 0;
    this.currentPhaseDurationsMs.fill(0);
  }

  startPhase(phase: PerformancePhase, timestampMs = performance.now()): void {
    if (!this.enabled || this.stackDepth >= MAX_NESTED_PHASE_DEPTH) {
      return;
    }

    const stackIndex = this.stackDepth;
    this.phaseStack[stackIndex] = PERFORMANCE_PHASE_INDEX[phase];
    this.phaseStartStack[stackIndex] = timestampMs;
    this.childDurationStack[stackIndex] = 0;
    this.stackDepth += 1;
  }

  endPhase(phase: PerformancePhase, timestampMs = performance.now()): void {
    if (!this.enabled || this.stackDepth <= 0) {
      return;
    }

    const stackIndex = this.stackDepth - 1;
    const expectedPhaseIndex = PERFORMANCE_PHASE_INDEX[phase];
    const phaseIndex = this.phaseStack[stackIndex];
    this.stackDepth -= 1;

    const elapsedMs = Math.max(0, timestampMs - this.phaseStartStack[stackIndex]);
    const exclusiveMs = Math.max(0, elapsedMs - this.childDurationStack[stackIndex]);
    this.currentPhaseDurationsMs[phaseIndex === expectedPhaseIndex ? phaseIndex : expectedPhaseIndex] +=
      exclusiveMs;

    if (this.stackDepth > 0) {
      this.childDurationStack[this.stackDepth - 1] += elapsedMs;
    }
  }

  measure<T>(phase: PerformancePhase, fn: () => T): T {
    if (!this.enabled) {
      return fn();
    }

    this.startPhase(phase);
    try {
      return fn();
    } finally {
      this.endPhase(phase);
    }
  }

  endFrame(
    timestampMs: number,
    context: PerformanceFrameContext,
    renderer: RendererPerformanceMetrics,
    scene: SceneStructureMetrics,
  ): void {
    if (!this.enabled) {
      return;
    }

    while (this.stackDepth > 0) {
      const phaseIndex = this.phaseStack[this.stackDepth - 1];
      this.endPhase(PERFORMANCE_PHASES[phaseIndex].id, timestampMs);
    }

    const frameDurationMs = Math.max(0, timestampMs - this.frameStartMs);
    const classifiedMs = sumDurationsExceptUnclassified(this.currentPhaseDurationsMs);
    this.currentPhaseDurationsMs[PERFORMANCE_PHASE_INDEX.unclassifiedFrameTime] =
      Math.max(0, frameDurationMs - classifiedMs);
    this.buffer.recordFrame(timestampMs, frameDurationMs, this.currentPhaseDurationsMs);

    if (frameDurationMs > PERFORMANCE_FRAME_THRESHOLDS_MS.target55Fps) {
      this.longFrames.unshift({
        context: { ...context },
        frameDurationMs,
        phaseTimingsMs: createPhaseTimingRecord(this.currentPhaseDurationsMs),
        renderer: { ...renderer },
        scene: { ...scene },
        timestampMs,
      });
      this.longFrames.splice(MAX_LONG_FRAME_RECORDS);
    }
  }

  clear(): void {
    if (!this.enabled) {
      return;
    }

    this.buffer.clear();
    this.longFrames.length = 0;
  }

  getSnapshot(): PerformanceProfilerSnapshot {
    return {
      buffer: this.buffer,
      enabled: this.enabled,
      longFrames: this.longFrames.map((frame) => ({
        ...frame,
        context: { ...frame.context },
        phaseTimingsMs: { ...frame.phaseTimingsMs },
        renderer: { ...frame.renderer },
        scene: { ...frame.scene },
      })),
      phaseNames: PERFORMANCE_PHASES.map((phase) => phase.id),
      totalFramesRecorded: this.buffer.getTotalRecorded(),
    };
  }
}

function sumDurationsExceptUnclassified(durations: Float64Array): number {
  let total = 0;
  const unclassifiedIndex = PERFORMANCE_PHASE_INDEX.unclassifiedFrameTime;

  for (let index = 0; index < durations.length; index += 1) {
    if (index !== unclassifiedIndex) {
      total += durations[index];
    }
  }

  return total;
}

function createPhaseTimingRecord(durations: Float64Array): Record<PerformancePhase, number> {
  return Object.fromEntries(
    PERFORMANCE_PHASES.map((phase, index) => [phase.id, durations[index]]),
  ) as Record<PerformancePhase, number>;
}
