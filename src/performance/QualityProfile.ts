import type { CrowdDensity } from '../presentation/CrowdPresentationController';

export type QualityMode =
  | 'adaptive60'
  | 'lockedBroadcast'
  | 'lockedPerformance';

export type QualityTier =
  | 'balanced'
  | 'broadcastHigh'
  | 'performance';

export interface QualityProfile {
  crowdDensity: CrowdDensity;
  crowdReactionsEnabled: boolean;
  crowdVisualsEnabled: boolean;
  displayName: string;
  maxPixelRatio: number;
  tier: QualityTier;
}

export interface QualityProfileSnapshot extends QualityProfile {
  measuredBasis: string;
}

export const DEFAULT_QUALITY_MODE: QualityMode = 'adaptive60';

export const QUALITY_TIER_ORDER: readonly QualityTier[] = [
  'performance',
  'balanced',
  'broadcastHigh',
] as const;

export const QUALITY_PROFILES: Readonly<Record<QualityTier, QualityProfileSnapshot>> = {
  broadcastHigh: {
    crowdDensity: 'low',
    crowdReactionsEnabled: true,
    crowdVisualsEnabled: true,
    displayName: 'Broadcast High',
    maxPixelRatio: 2,
    measuredBasis:
      'Passing 11v11 broadcast reference: 500 spectators, 376 calls, 194500 triangles.',
    tier: 'broadcastHigh',
  },
  balanced: {
    crowdDensity: 'low',
    crowdReactionsEnabled: true,
    crowdVisualsEnabled: true,
    displayName: 'Balanced',
    maxPixelRatio: 1.5,
    measuredBasis:
      'Uses the measured low-density crowd and reduces only render scale.',
    tier: 'balanced',
  },
  performance: {
    crowdDensity: 'low',
    crowdReactionsEnabled: false,
    crowdVisualsEnabled: false,
    displayName: 'Performance',
    maxPixelRatio: 1,
    measuredBasis:
      'Matches measured crowd-off and presentation-reduced profiles without changing players or gameplay.',
    tier: 'performance',
  },
} as const;

export function normalizeQualityMode(value: unknown): QualityMode {
  if (
    value === 'adaptive60' ||
    value === 'adaptive' ||
    value === 'adaptive-60' ||
    value === 'adaptive60fps'
  ) {
    return 'adaptive60';
  }

  if (
    value === 'lockedBroadcast' ||
    value === 'broadcast' ||
    value === 'broadcast-locked' ||
    value === 'locked-broadcast'
  ) {
    return 'lockedBroadcast';
  }

  if (
    value === 'lockedPerformance' ||
    value === 'performance' ||
    value === 'performance-locked' ||
    value === 'locked-performance'
  ) {
    return 'lockedPerformance';
  }

  return DEFAULT_QUALITY_MODE;
}

export function isQualityMode(value: unknown): value is QualityMode {
  return normalizeQualityMode(value) === value;
}

export function getInitialQualityTier(mode: QualityMode): QualityTier {
  return mode === 'lockedPerformance' ? 'performance' : 'broadcastHigh';
}

export function getLockedQualityTier(mode: QualityMode): QualityTier | null {
  if (mode === 'lockedBroadcast') {
    return 'broadcastHigh';
  }

  if (mode === 'lockedPerformance') {
    return 'performance';
  }

  return null;
}

export function getQualityProfile(tier: QualityTier): QualityProfileSnapshot {
  return QUALITY_PROFILES[tier];
}

export function getNextLowerQualityTier(tier: QualityTier): QualityTier {
  const index = QUALITY_TIER_ORDER.indexOf(tier);
  return QUALITY_TIER_ORDER[Math.max(0, index - 1)] ?? 'performance';
}

export function getNextHigherQualityTier(tier: QualityTier): QualityTier {
  const index = QUALITY_TIER_ORDER.indexOf(tier);
  return QUALITY_TIER_ORDER[Math.min(QUALITY_TIER_ORDER.length - 1, index + 1)] ??
    'broadcastHigh';
}

export function isLowerQualityTier(a: QualityTier, b: QualityTier): boolean {
  return QUALITY_TIER_ORDER.indexOf(a) < QUALITY_TIER_ORDER.indexOf(b);
}
