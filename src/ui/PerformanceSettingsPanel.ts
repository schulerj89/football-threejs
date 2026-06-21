import type { AdaptiveQualitySnapshot } from '../performance/AdaptiveQualityController';
import type { RuntimePerformanceSnapshot } from '../performance/RuntimePerformanceMonitor';
import {
  normalizeQualityMode,
  type QualityMode,
} from '../performance/QualityProfile';

export interface QualityDebugSnapshot {
  limitingSubsystem: string | null;
  monitor: RuntimePerformanceSnapshot;
  pixelRatio: number;
  quality: AdaptiveQualitySnapshot;
}

export function createQualityModeSelect(
  initialMode: QualityMode,
  onChange: (mode: QualityMode) => void,
): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'settings-row';

  const span = document.createElement('span');
  span.textContent = 'Quality mode';

  const select = document.createElement('select');
  for (const [value, text] of [
    ['adaptive60', 'Adaptive 60 FPS'],
    ['lockedBroadcast', 'Broadcast Quality Locked'],
    ['lockedPerformance', 'Performance Quality Locked'],
  ] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    select.append(option);
  }
  select.value = initialMode;
  select.addEventListener('change', () => onChange(normalizeQualityMode(select.value)));

  label.append(span, select);
  return label;
}

export function createPerformanceDebugOverlay(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'performance-debug-overlay';
  document.body.appendChild(element);
  return element;
}

export function syncPerformanceDebugOverlay(
  element: HTMLElement,
  snapshot: QualityDebugSnapshot,
): void {
  element.textContent = [
    'QUALITY',
    `MODE ${snapshot.quality.mode}`,
    `TIER ${snapshot.quality.currentTier} (${snapshot.quality.profile.displayName})`,
    `PIXEL_RATIO ${snapshot.pixelRatio.toFixed(2)}`,
    `FPS ${snapshot.monitor.currentFps.toFixed(1)}`,
    `MEDIAN ${snapshot.monitor.medianFrameTimeMs.toFixed(2)} ms`,
    `P95 ${snapshot.monitor.p95FrameTimeMs.toFixed(2)} ms`,
    `SAMPLES ${snapshot.monitor.sampleCount}`,
    `IGNORED ${snapshot.monitor.ignoredReason ?? 'none'}`,
    `DOWN ${snapshot.quality.recentDowngradeReason ?? 'none'}`,
    `UP ${snapshot.quality.recentUpgradeReason ?? 'none'}`,
    `PENDING ${snapshot.quality.scheduler.pendingTier ?? 'none'}`,
    `LIMIT ${snapshot.limitingSubsystem ?? 'latest profiler data unavailable'}`,
  ].join('\n');
}
