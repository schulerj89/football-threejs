import { describe, expect, it } from 'vitest';
import {
  AdaptiveQualityController,
  type AdaptiveQualityPolicy,
} from '../src/performance/AdaptiveQualityController';
import { RuntimePerformanceMonitor } from '../src/performance/RuntimePerformanceMonitor';
import type { RuntimePerformanceSnapshot } from '../src/performance/RuntimePerformanceMonitor';

const FAST_POLICY: AdaptiveQualityPolicy = {
  cooldownSeconds: 0,
  downgradeP95FrameTimeMs: 18.18,
  downgradeSustainedSeconds: 0.1,
  upgradeP95FrameTimeMs: 15.5,
  upgradeSustainedSeconds: 0.2,
};

describe('runtime performance monitor', () => {
  it('ignores startup, title, hidden-tab, and debug-overhead frames', () => {
    const monitor = new RuntimePerformanceMonitor({
      maxSampleAgeSeconds: 1,
      minimumSampleCount: 2,
      startupIgnoreSeconds: 0.2,
    });

    expect(monitor.update({ active: false, deltaSeconds: 1 / 60 }).ignoredReason).toBe('inactive');
    expect(monitor.update({ active: true, hidden: true, deltaSeconds: 1 / 60 }).ignoredReason).toBe('hidden-tab');
    expect(monitor.update({ active: true, debugOverheadActive: true, deltaSeconds: 1 / 60 }).ignoredReason).toBe('debug-overhead');
    expect(monitor.update({ active: true, deltaSeconds: 0.1 }).ignoredReason).toBe('startup');
  });

  it('reports rolling median, p95, and current FPS once enough samples exist', () => {
    const monitor = new RuntimePerformanceMonitor({
      maxSampleAgeSeconds: 4,
      minimumSampleCount: 3,
      startupIgnoreSeconds: 0,
    });

    monitor.update({ active: true, deltaSeconds: 0.016, nowSeconds: 0.016 });
    monitor.update({ active: true, deltaSeconds: 0.020, nowSeconds: 0.036 });
    const snapshot = monitor.update({ active: true, deltaSeconds: 0.018, nowSeconds: 0.054 });

    expect(snapshot.ready).toBe(true);
    expect(snapshot.sampleCount).toBe(3);
    expect(snapshot.medianFrameTimeMs).toBeCloseTo(18);
    expect(snapshot.p95FrameTimeMs).toBeGreaterThan(19);
    expect(snapshot.currentFps).toBeCloseTo(55.56, 1);
  });
});

describe('adaptive quality controller', () => {
  it('degrades only after sustained pressure, then respects safe boundaries for crowd changes', () => {
    const controller = new AdaptiveQualityController('adaptive60', FAST_POLICY);

    expect(controller.getSnapshot().currentTier).toBe('broadcastHigh');

    const first = controller.update({
      context: { appPhase: 'gameplay', playState: 'live' },
      deltaSeconds: 0.1,
      monitor: createMonitorSnapshot(20),
    });
    expect(first.applied).toBe(true);
    expect(controller.getSnapshot().currentTier).toBe('balanced');

    const blocked = controller.update({
      context: { appPhase: 'gameplay', playState: 'live' },
      deltaSeconds: 0.1,
      monitor: createMonitorSnapshot(22),
    });
    expect(blocked.applied).toBe(false);
    expect(controller.getSnapshot().currentTier).toBe('balanced');
    expect(controller.getSnapshot().scheduler.pendingTier).toBe('performance');

    const applied = controller.update({
      context: { appPhase: 'gameplay', playState: 'preSnap' },
      deltaSeconds: 0.016,
      monitor: createMonitorSnapshot(22),
    });
    expect(applied.applied).toBe(true);
    expect(controller.getSnapshot().currentTier).toBe('performance');
  });

  it('recovers upward only after sustained headroom', () => {
    const controller = new AdaptiveQualityController('lockedPerformance', FAST_POLICY);
    expect(controller.getSnapshot().currentTier).toBe('performance');

    controller.setMode('adaptive60', { appPhase: 'gameplay', playState: 'preSnap' });
    expect(controller.getSnapshot().currentTier).toBe('performance');

    controller.update({
      context: { appPhase: 'gameplay', playState: 'preSnap' },
      deltaSeconds: 0.1,
      monitor: createMonitorSnapshot(14),
    });
    const result = controller.update({
      context: { appPhase: 'gameplay', playState: 'preSnap' },
      deltaSeconds: 0.1,
      monitor: createMonitorSnapshot(14),
    });

    expect(result.applied).toBe(true);
    expect(controller.getSnapshot().currentTier).toBe('balanced');
  });

  it('does not adapt when a quality profile is locked', () => {
    const controller = new AdaptiveQualityController('lockedBroadcast', FAST_POLICY);

    const result = controller.update({
      context: { appPhase: 'gameplay', playState: 'preSnap' },
      deltaSeconds: 1,
      monitor: createMonitorSnapshot(40),
    });

    expect(result.applied).toBe(false);
    expect(controller.getSnapshot().currentTier).toBe('broadcastHigh');
  });
});

function createMonitorSnapshot(p95FrameTimeMs: number): RuntimePerformanceSnapshot {
  return {
    currentFps: 1000 / p95FrameTimeMs,
    currentFrameTimeMs: p95FrameTimeMs,
    ignoredReason: null,
    medianFrameTimeMs: p95FrameTimeMs * 0.85,
    p95FrameTimeMs,
    ready: true,
    sampleCount: 120,
  };
}
