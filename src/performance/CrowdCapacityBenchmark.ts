import * as THREE from 'three';
import {
  CROWD_COUNT_MAX,
  clampCrowdCount,
} from '../crowd/CrowdConfiguration';
import { CrowdResourceOwner } from '../crowd/CrowdResourceOwner';
import {
  resourcesReturnedNearBaseline,
} from '../crowd/CrowdMetrics';
import {
  CROWD_DENSITY_PRESETS,
  type CrowdDensity,
} from '../presentation/CrowdPresentationController';
import type { CrowdResources } from '../crowd/CrowdTypes';
import type {
  CrowdCapacityBenchmarkSnapshot,
  CrowdCapacityReport,
  CrowdCapacityTrialResult,
  SceneResourceProfileSnapshot,
} from './MemoryTypes';

export type CrowdCapacityTargetProfile = '30fps' | '60fps' | 'custom';

export interface CrowdCapacityBenchmarkOptions {
  candidateCounts?: readonly number[];
  createCrowdResourceOwner?: (count: number) => CrowdCapacityCrowdOwner;
  createProfile: () => SceneResourceProfileSnapshot;
  memoryBudgetBytes?: number;
  scene: THREE.Scene;
  targetFrameTimeMs?: number;
  targetProfile?: CrowdCapacityTargetProfile;
  trialDurationSeconds?: number;
  warmupSeconds?: number;
}

export interface CrowdCapacityCrowdOwner {
  group: THREE.Group;
  resources: CrowdResources;
  dispose(): void;
}

type BenchmarkPhase = 'idle' | 'sampling' | 'warmup';

const DEFAULT_CANDIDATE_COUNTS = [0, 500, 1_000, 2_000, 5_000, 10_000] as const;
const DEFAULT_TRIAL_DURATION_SECONDS = 1.2;
const DEFAULT_WARMUP_SECONDS = 0.3;
const DEFAULT_MEMORY_BUDGET_BYTES = 96 * 1024 * 1024;

export class CrowdCapacityBenchmark {
  private activeOwner: CrowdCapacityCrowdOwner | null = null;
  private baseline: SceneResourceProfileSnapshot | null = null;
  private currentCandidateIndex = -1;
  private currentCount: number | null = null;
  private currentTrialSeconds = 0;
  private phase: BenchmarkPhase = 'idle';
  private recommendedCount: number | null = null;
  private readonly samples: number[] = [];
  private status: CrowdCapacityBenchmarkSnapshot['status'] = 'idle';
  private stopReason: string | null = null;
  private readonly testedCounts: CrowdCapacityTrialResult[] = [];

  private readonly candidateCounts: number[];
  private readonly memoryBudgetBytes: number;
  private readonly targetFrameTimeMs: number;
  private readonly trialDurationSeconds: number;
  private readonly warmupSeconds: number;
  private readonly createCrowdResourceOwner: (count: number) => CrowdCapacityCrowdOwner;

  constructor(private readonly options: CrowdCapacityBenchmarkOptions) {
    this.candidateCounts = normalizeCandidateCounts(
      options.candidateCounts ?? DEFAULT_CANDIDATE_COUNTS,
    );
    this.targetFrameTimeMs =
      options.targetFrameTimeMs ??
      resolveTargetFrameTimeMs(options.targetProfile ?? '60fps');
    this.trialDurationSeconds =
      options.trialDurationSeconds ?? DEFAULT_TRIAL_DURATION_SECONDS;
    this.warmupSeconds = options.warmupSeconds ?? DEFAULT_WARMUP_SECONDS;
    this.memoryBudgetBytes = options.memoryBudgetBytes ?? DEFAULT_MEMORY_BUDGET_BYTES;
    this.createCrowdResourceOwner =
      options.createCrowdResourceOwner ??
      ((count) => new CrowdResourceOwner(count, 'crowd-capacity-benchmark'));
  }

  start(): CrowdCapacityBenchmarkSnapshot {
    this.cancelActiveCrowd();
    this.baseline = this.options.createProfile();
    this.currentCandidateIndex = -1;
    this.currentCount = null;
    this.currentTrialSeconds = 0;
    this.phase = 'idle';
    this.recommendedCount = null;
    this.samples.length = 0;
    this.status = 'running';
    this.stopReason = null;
    this.testedCounts.length = 0;
    this.beginNextTrial();
    return this.getSnapshot();
  }

  cancel(): CrowdCapacityBenchmarkSnapshot {
    if (this.status !== 'running') {
      return this.getSnapshot();
    }

    this.cancelActiveCrowd();
    this.currentCount = null;
    this.currentTrialSeconds = 0;
    this.phase = 'idle';
    this.status = 'cancelled';
    this.stopReason = 'cancelled';
    return this.getSnapshot();
  }

  update(deltaSeconds: number): void {
    if (this.status !== 'running' || this.currentCount === null) {
      return;
    }
    if (isDocumentHidden()) {
      return;
    }

    const delta = Math.max(0, Math.min(deltaSeconds, 0.25));
    this.currentTrialSeconds += delta;

    if (this.phase === 'warmup') {
      if (this.currentTrialSeconds >= this.warmupSeconds) {
        this.phase = 'sampling';
        this.currentTrialSeconds = 0;
        this.samples.length = 0;
      }
      return;
    }

    this.samples.push(delta * 1000);
    if (this.currentTrialSeconds >= this.trialDurationSeconds) {
      this.finishCurrentTrial();
      if (this.status === 'running') {
        this.beginNextTrial();
      }
    }
  }

  getSnapshot(): CrowdCapacityBenchmarkSnapshot {
    return {
      activeCount: this.currentCount,
      candidateCounts: [...this.candidateCounts],
      currentTrialSeconds: this.currentTrialSeconds,
      recommendedCount: this.recommendedCount,
      status: this.status,
      stopReason: this.stopReason,
      targetFrameTimeMs: this.targetFrameTimeMs,
      testedCounts: [...this.testedCounts],
    };
  }

  exportReport(): CrowdCapacityReport | null {
    if (!this.baseline) {
      return null;
    }
    const profile = this.options.createProfile();
    const unavailableMeasurementFields: string[] = [];
    if (!profile.browserMemory.measureUserAgentSpecificMemory.supported) {
      unavailableMeasurementFields.push('measureUserAgentSpecificMemory');
    }
    if (!profile.browserMemory.performanceMemory.supported) {
      unavailableMeasurementFields.push('performance.memory');
    }
    if (!profile.browserMemory.deviceMemory.supported) {
      unavailableMeasurementFields.push('navigator.deviceMemory');
    }

    return {
      baseline: this.baseline,
      candidateCounts: [...this.candidateCounts],
      recommendedCount: this.recommendedCount ?? 0,
      recommendationLabel: 'Recommended for this browser session',
      renderer: profile.renderer,
      stopReason: this.stopReason ?? 'not completed',
      targetFrameTimeMs: this.targetFrameTimeMs,
      testedCounts: [...this.testedCounts],
      timestamp: new Date().toISOString(),
      unavailableMeasurementFields,
      userAgent: globalThis.navigator?.userAgent ?? 'unavailable',
    };
  }

  applyRecommendedDensity(
    updateDensity: (density: CrowdDensity) => void,
  ): CrowdDensity | null {
    if (this.recommendedCount === null) {
      return null;
    }

    const density = resolveCrowdDensityForRecommendedCount(this.recommendedCount);
    updateDensity(density);
    return density;
  }

  dispose(): void {
    this.cancelActiveCrowd();
  }

  private beginNextTrial(): void {
    this.currentCandidateIndex += 1;
    if (this.currentCandidateIndex >= this.candidateCounts.length) {
      this.complete('maximum configured spectator count reached');
      return;
    }

    const count = this.candidateCounts[this.currentCandidateIndex];
    this.currentCount = count;
    this.currentTrialSeconds = 0;
    this.samples.length = 0;
    this.phase = 'warmup';
    this.cancelActiveCrowd();

    if (count > 0) {
      this.activeOwner = this.createCrowdResourceOwner(count);
      this.options.scene.add(this.activeOwner.group);
    }
  }

  private finishCurrentTrial(): void {
    if (!this.baseline || this.currentCount === null) {
      return;
    }

    const profile = this.options.createProfile();
    const afterDisposeBaseline = {
      geometries: this.baseline.renderer.geometries,
      textures: this.baseline.renderer.textures,
    };
    const incrementalBufferBytes = Math.max(
      0,
      profile.calculatedBufferBytes.totalBytes -
        this.baseline.calculatedBufferBytes.totalBytes,
    );
    const trial = createTrialResult({
      count: this.currentCount,
      incrementalBufferBytes,
      jsApplicationMemoryBytes:
        profile.browserMemory.performanceMemory.usedJSHeapSize ?? null,
      profile,
      samples: this.samples,
      resourceReturnNearBaseline: true,
    });

    this.cancelActiveCrowd();
    const afterDisposeProfile = this.options.createProfile();
    trial.resourceReturnNearBaseline = resourcesReturnedNearBaseline(
      afterDisposeBaseline,
      {
        geometries: afterDisposeProfile.renderer.geometries,
        textures: afterDisposeProfile.renderer.textures,
      },
    );
    this.testedCounts.push(trial);

    if (trial.p95FrameTimeMs <= this.targetFrameTimeMs &&
      incrementalBufferBytes <= this.memoryBudgetBytes) {
      this.recommendedCount = this.currentCount;
      return;
    }

    if (incrementalBufferBytes > this.memoryBudgetBytes) {
      this.complete('configured memory budget exceeded');
    } else {
      this.complete('configured frame-time budget exceeded consistently');
    }
  }

  private complete(reason: string): void {
    this.cancelActiveCrowd();
    this.currentCount = null;
    this.currentTrialSeconds = 0;
    this.phase = 'idle';
    this.status = 'completed';
    this.stopReason = reason;
  }

  private cancelActiveCrowd(): void {
    if (!this.activeOwner) {
      return;
    }

    this.options.scene.remove(this.activeOwner.group);
    this.activeOwner.dispose();
    this.activeOwner = null;
  }
}

export function resolveTargetFrameTimeMs(profile: CrowdCapacityTargetProfile): number {
  if (profile === '30fps') {
    return 33.33;
  }
  return 16.67;
}

export function resolveCrowdDensityForRecommendedCount(count: number): CrowdDensity {
  const entries = Object.entries(CROWD_DENSITY_PRESETS)
    .map(([density, presetCount]) => ({
      density: density as CrowdDensity,
      presetCount,
    }))
    .sort((a, b) => a.presetCount - b.presetCount);

  let selected = entries[0]?.density ?? 'low';
  for (const entry of entries) {
    if (entry.presetCount <= count) {
      selected = entry.density;
    }
  }
  return selected;
}

export function normalizeCandidateCounts(counts: readonly number[]): number[] {
  return [...new Set(counts.map(clampCrowdCount))]
    .filter((count) => count >= 0 && count <= CROWD_COUNT_MAX)
    .sort((a, b) => a - b);
}

export function calculatePercentile(samples: readonly number[], percentile: number): number {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1),
  );
  return sorted[index];
}

function createTrialResult({
  count,
  incrementalBufferBytes,
  jsApplicationMemoryBytes,
  profile,
  resourceReturnNearBaseline,
  samples,
}: {
  count: number;
  incrementalBufferBytes: number;
  jsApplicationMemoryBytes: number | null;
  profile: SceneResourceProfileSnapshot;
  resourceReturnNearBaseline: boolean;
  samples: readonly number[];
}): CrowdCapacityTrialResult {
  const totalFrameTimeMs = samples.reduce((sum, sample) => sum + sample, 0);
  const averageFrameTimeMs = samples.length > 0 ? totalFrameTimeMs / samples.length : 0;
  const maximumFrameTimeMs = samples.length > 0 ? Math.max(...samples) : 0;
  return {
    averageFrameTimeMs,
    drawCalls: profile.renderer.drawCalls,
    frameCount: samples.length,
    incrementalBufferBytes,
    jsApplicationMemoryBytes,
    minimumObservedFps: maximumFrameTimeMs > 0 ? 1000 / maximumFrameTimeMs : 0,
    p95FrameTimeMs: calculatePercentile(samples, 95),
    requestedCount: count,
    resourceReturnNearBaseline,
    triangles: profile.renderer.triangles,
  };
}

function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}
