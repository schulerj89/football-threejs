import type { PlayState } from '../playState';
import {
  getQualityProfile,
  type QualityProfileSnapshot,
  type QualityTier,
} from './QualityProfile';

export interface QualityTransitionContext {
  appPhase: 'gameplay' | 'pregamePresentation' | 'title';
  playState: PlayState;
}

export interface QualityTransitionSchedulerSnapshot {
  lastAppliedReason: string | null;
  lastRejectedReason: string | null;
  pendingReason: string | null;
  pendingTier: QualityTier | null;
  resourceRebuildBlocked: boolean;
}

export interface QualityTransitionResult {
  applied: boolean;
  profile: QualityProfileSnapshot | null;
  reason: string | null;
}

export class QualityTransitionScheduler {
  private pendingReason: string | null = null;
  private pendingTier: QualityTier | null = null;
  private lastAppliedReason: string | null = null;
  private lastRejectedReason: string | null = null;
  private resourceRebuildBlocked = false;

  request(
    currentTier: QualityTier,
    targetTier: QualityTier,
    context: QualityTransitionContext,
    reason: string,
  ): QualityTransitionResult {
    if (targetTier === currentTier) {
      this.pendingReason = null;
      this.pendingTier = null;
      return { applied: false, profile: null, reason: null };
    }

    if (!this.canApplyTransition(currentTier, targetTier, context)) {
      this.pendingReason = reason;
      this.pendingTier = targetTier;
      this.lastRejectedReason = 'waiting-for-safe-boundary';
      this.resourceRebuildBlocked = true;
      return { applied: false, profile: null, reason: this.lastRejectedReason };
    }

    this.pendingReason = null;
    this.pendingTier = null;
    this.lastAppliedReason = reason;
    this.lastRejectedReason = null;
    this.resourceRebuildBlocked = false;
    return {
      applied: true,
      profile: getQualityProfile(targetTier),
      reason,
    };
  }

  flushPending(
    currentTier: QualityTier,
    context: QualityTransitionContext,
  ): QualityTransitionResult {
    if (!this.pendingTier || this.pendingTier === currentTier) {
      return { applied: false, profile: null, reason: null };
    }

    return this.request(
      currentTier,
      this.pendingTier,
      context,
      this.pendingReason ?? 'pending-quality-transition',
    );
  }

  clear(): void {
    this.pendingReason = null;
    this.pendingTier = null;
    this.resourceRebuildBlocked = false;
  }

  getSnapshot(): QualityTransitionSchedulerSnapshot {
    return {
      lastAppliedReason: this.lastAppliedReason,
      lastRejectedReason: this.lastRejectedReason,
      pendingReason: this.pendingReason,
      pendingTier: this.pendingTier,
      resourceRebuildBlocked: this.resourceRebuildBlocked,
    };
  }

  private canApplyTransition(
    currentTier: QualityTier,
    targetTier: QualityTier,
    context: QualityTransitionContext,
  ): boolean {
    if (!requiresResourceBoundary(currentTier, targetTier)) {
      return true;
    }

    return isSafeResourceBoundary(context);
  }
}

export function isSafeResourceBoundary(context: QualityTransitionContext): boolean {
  return context.appPhase === 'title' ||
    context.playState === 'preSnap' ||
    context.playState === 'dead' ||
    context.playState === 'gameOver';
}

function requiresResourceBoundary(
  currentTier: QualityTier,
  targetTier: QualityTier,
): boolean {
  const current = getQualityProfile(currentTier);
  const next = getQualityProfile(targetTier);

  return current.crowdDensity !== next.crowdDensity ||
    current.crowdReactionsEnabled !== next.crowdReactionsEnabled ||
    current.crowdVisualsEnabled !== next.crowdVisualsEnabled;
}
