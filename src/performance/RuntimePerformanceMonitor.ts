import { summarizeValues } from './PerformanceReport';

export interface RuntimePerformanceMonitorConfig {
  maxSampleAgeSeconds: number;
  minimumSampleCount: number;
  startupIgnoreSeconds: number;
}

export interface RuntimePerformanceMonitorUpdate {
  active: boolean;
  debugOverheadActive?: boolean;
  deltaSeconds: number;
  hidden?: boolean;
  nowSeconds?: number;
  warmupActive?: boolean;
}

export interface RuntimePerformanceSnapshot {
  currentFps: number;
  currentFrameTimeMs: number;
  ignoredReason: string | null;
  medianFrameTimeMs: number;
  p95FrameTimeMs: number;
  ready: boolean;
  sampleCount: number;
}

interface RuntimeFrameSample {
  frameTimeMs: number;
  timestampSeconds: number;
}

export const DEFAULT_RUNTIME_PERFORMANCE_MONITOR_CONFIG: RuntimePerformanceMonitorConfig = {
  maxSampleAgeSeconds: 4,
  minimumSampleCount: 45,
  startupIgnoreSeconds: 3,
};

export class RuntimePerformanceMonitor {
  private readonly samples: RuntimeFrameSample[] = [];
  private elapsedVisibleSeconds = 0;
  private lastSnapshot: RuntimePerformanceSnapshot = createEmptySnapshot('startup');

  constructor(
    private readonly config: RuntimePerformanceMonitorConfig =
      DEFAULT_RUNTIME_PERFORMANCE_MONITOR_CONFIG,
  ) {}

  reset(reason = 'reset'): void {
    this.samples.length = 0;
    this.elapsedVisibleSeconds = 0;
    this.lastSnapshot = createEmptySnapshot(reason);
  }

  update(update: RuntimePerformanceMonitorUpdate): RuntimePerformanceSnapshot {
    const deltaSeconds = clamp(update.deltaSeconds, 0, 0.25);

    if (update.hidden) {
      this.samples.length = 0;
      this.lastSnapshot = createEmptySnapshot('hidden-tab');
      return this.lastSnapshot;
    }

    if (!update.active) {
      this.samples.length = 0;
      this.elapsedVisibleSeconds = 0;
      this.lastSnapshot = createEmptySnapshot('inactive');
      return this.lastSnapshot;
    }

    if (update.debugOverheadActive) {
      this.samples.length = 0;
      this.lastSnapshot = createEmptySnapshot('debug-overhead');
      return this.lastSnapshot;
    }

    if (update.warmupActive) {
      this.samples.length = 0;
      this.lastSnapshot = createEmptySnapshot('benchmark-warmup');
      return this.lastSnapshot;
    }

    this.elapsedVisibleSeconds += deltaSeconds;
    if (this.elapsedVisibleSeconds < this.config.startupIgnoreSeconds) {
      this.samples.length = 0;
      this.lastSnapshot = createEmptySnapshot('startup');
      return this.lastSnapshot;
    }

    const nowSeconds = update.nowSeconds ?? this.elapsedVisibleSeconds;
    const frameTimeMs = deltaSeconds * 1000;
    this.samples.push({
      frameTimeMs,
      timestampSeconds: nowSeconds,
    });
    this.dropExpiredSamples(nowSeconds);

    const frameTimes = this.samples.map((sample) => sample.frameTimeMs);
    const summary = summarizeValues(frameTimes);
    this.lastSnapshot = {
      currentFps: frameTimeMs > 0 ? 1000 / frameTimeMs : 0,
      currentFrameTimeMs: frameTimeMs,
      ignoredReason: null,
      medianFrameTimeMs: summary.median,
      p95FrameTimeMs: summary.p95,
      ready: this.samples.length >= this.config.minimumSampleCount,
      sampleCount: this.samples.length,
    };
    return this.lastSnapshot;
  }

  getSnapshot(): RuntimePerformanceSnapshot {
    return { ...this.lastSnapshot };
  }

  private dropExpiredSamples(nowSeconds: number): void {
    const oldestAllowed = nowSeconds - this.config.maxSampleAgeSeconds;
    while (
      this.samples.length > 0 &&
      this.samples[0].timestampSeconds < oldestAllowed
    ) {
      this.samples.shift();
    }
  }
}

function createEmptySnapshot(reason: string): RuntimePerformanceSnapshot {
  return {
    currentFps: 0,
    currentFrameTimeMs: 0,
    ignoredReason: reason,
    medianFrameTimeMs: 0,
    p95FrameTimeMs: 0,
    ready: false,
    sampleCount: 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
