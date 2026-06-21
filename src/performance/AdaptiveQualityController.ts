import {
  getInitialQualityTier,
  getLockedQualityTier,
  getNextHigherQualityTier,
  getNextLowerQualityTier,
  getQualityProfile,
  type QualityMode,
  type QualityProfileSnapshot,
  type QualityTier,
} from './QualityProfile';
import type { RuntimePerformanceSnapshot } from './RuntimePerformanceMonitor';
import {
  QualityTransitionScheduler,
  type QualityTransitionContext,
  type QualityTransitionSchedulerSnapshot,
} from './QualityTransitionScheduler';

export interface AdaptiveQualityPolicy {
  cooldownSeconds: number;
  downgradeP95FrameTimeMs: number;
  downgradeSustainedSeconds: number;
  upgradeP95FrameTimeMs: number;
  upgradeSustainedSeconds: number;
}

export interface AdaptiveQualityUpdate {
  context: QualityTransitionContext;
  deltaSeconds: number;
  monitor: RuntimePerformanceSnapshot;
}

export interface AdaptiveQualityUpdateResult {
  applied: boolean;
  profile: QualityProfileSnapshot | null;
}

export interface AdaptiveQualitySnapshot {
  currentTier: QualityTier;
  mode: QualityMode;
  profile: QualityProfileSnapshot;
  recentDowngradeReason: string | null;
  recentUpgradeReason: string | null;
  recoverySeconds: number;
  scheduler: QualityTransitionSchedulerSnapshot;
  sustainedPressureSeconds: number;
}

export const DEFAULT_ADAPTIVE_QUALITY_POLICY: AdaptiveQualityPolicy = {
  cooldownSeconds: 5,
  downgradeP95FrameTimeMs: 18.18,
  downgradeSustainedSeconds: 1.5,
  upgradeP95FrameTimeMs: 15.5,
  upgradeSustainedSeconds: 8,
};

export class AdaptiveQualityController {
  private cooldownRemainingSeconds = 0;
  private currentTier: QualityTier;
  private recentDowngradeReason: string | null = null;
  private recentUpgradeReason: string | null = null;
  private recoverySeconds = 0;
  private readonly scheduler = new QualityTransitionScheduler();
  private sustainedPressureSeconds = 0;

  constructor(
    private mode: QualityMode,
    private readonly policy: AdaptiveQualityPolicy = DEFAULT_ADAPTIVE_QUALITY_POLICY,
  ) {
    this.currentTier = getInitialQualityTier(mode);
  }

  setMode(mode: QualityMode, context: QualityTransitionContext): AdaptiveQualityUpdateResult {
    this.mode = mode;
    this.resetPressureState();
    const lockedTier = getLockedQualityTier(mode);

    if (!lockedTier) {
      const pending = this.scheduler.flushPending(this.currentTier, context);
      if (pending.applied && pending.profile) {
        this.applyTier(pending.profile.tier);
      }
      return {
        applied: pending.applied,
        profile: pending.profile,
      };
    }

    const transition = this.scheduler.request(
      this.currentTier,
      lockedTier,
      context,
      `locked-quality:${mode}`,
    );
    if (transition.applied && transition.profile) {
      this.currentTier = transition.profile.tier;
    }
    return {
      applied: transition.applied,
      profile: transition.profile,
    };
  }

  update({
    context,
    deltaSeconds,
    monitor,
  }: AdaptiveQualityUpdate): AdaptiveQualityUpdateResult {
    const clampedDelta = Math.min(0.25, Math.max(0, deltaSeconds));
    this.cooldownRemainingSeconds = Math.max(
      0,
      this.cooldownRemainingSeconds - clampedDelta,
    );

    const pending = this.scheduler.flushPending(this.currentTier, context);
    if (pending.applied && pending.profile) {
      this.applyTier(pending.profile.tier);
      return { applied: true, profile: pending.profile };
    }

    const lockedTier = getLockedQualityTier(this.mode);
    if (lockedTier) {
      if (lockedTier !== this.currentTier) {
        const transition = this.scheduler.request(
          this.currentTier,
          lockedTier,
          context,
          `locked-quality:${this.mode}`,
        );
        if (transition.applied && transition.profile) {
          this.applyTier(transition.profile.tier);
        }
        return {
          applied: transition.applied,
          profile: transition.profile,
        };
      }
      return { applied: false, profile: null };
    }

    if (!monitor.ready || this.cooldownRemainingSeconds > 0) {
      this.sustainedPressureSeconds = 0;
      this.recoverySeconds = 0;
      return { applied: false, profile: null };
    }

    if (monitor.p95FrameTimeMs > this.policy.downgradeP95FrameTimeMs) {
      this.sustainedPressureSeconds += clampedDelta;
      this.recoverySeconds = 0;
      if (this.sustainedPressureSeconds >= this.policy.downgradeSustainedSeconds) {
        return this.requestTier(
          getNextLowerQualityTier(this.currentTier),
          context,
          `rolling p95 ${monitor.p95FrameTimeMs.toFixed(2)} ms exceeded ` +
            `${this.policy.downgradeP95FrameTimeMs.toFixed(2)} ms`,
          'downgrade',
        );
      }
      return { applied: false, profile: null };
    }

    if (monitor.p95FrameTimeMs < this.policy.upgradeP95FrameTimeMs) {
      this.recoverySeconds += clampedDelta;
      this.sustainedPressureSeconds = 0;
      if (this.recoverySeconds >= this.policy.upgradeSustainedSeconds) {
        return this.requestTier(
          getNextHigherQualityTier(this.currentTier),
          context,
          `rolling p95 ${monitor.p95FrameTimeMs.toFixed(2)} ms stayed below ` +
            `${this.policy.upgradeP95FrameTimeMs.toFixed(2)} ms`,
          'upgrade',
        );
      }
      return { applied: false, profile: null };
    }

    this.sustainedPressureSeconds = 0;
    this.recoverySeconds = 0;
    return { applied: false, profile: null };
  }

  getProfile(): QualityProfileSnapshot {
    return getQualityProfile(this.currentTier);
  }

  getSnapshot(): AdaptiveQualitySnapshot {
    return {
      currentTier: this.currentTier,
      mode: this.mode,
      profile: this.getProfile(),
      recentDowngradeReason: this.recentDowngradeReason,
      recentUpgradeReason: this.recentUpgradeReason,
      recoverySeconds: this.recoverySeconds,
      scheduler: this.scheduler.getSnapshot(),
      sustainedPressureSeconds: this.sustainedPressureSeconds,
    };
  }

  private requestTier(
    targetTier: QualityTier,
    context: QualityTransitionContext,
    reason: string,
    direction: 'downgrade' | 'upgrade',
  ): AdaptiveQualityUpdateResult {
    const transition = this.scheduler.request(
      this.currentTier,
      targetTier,
      context,
      reason,
    );

    if (!transition.applied || !transition.profile) {
      return { applied: false, profile: null };
    }

    this.applyTier(transition.profile.tier);
    if (direction === 'downgrade') {
      this.recentDowngradeReason = reason;
    } else {
      this.recentUpgradeReason = reason;
    }
    return { applied: true, profile: transition.profile };
  }

  private applyTier(tier: QualityTier): void {
    if (tier === this.currentTier) {
      return;
    }

    this.currentTier = tier;
    this.cooldownRemainingSeconds = this.policy.cooldownSeconds;
    this.resetPressureState();
  }

  private resetPressureState(): void {
    this.sustainedPressureSeconds = 0;
    this.recoverySeconds = 0;
    this.scheduler.clear();
  }
}
