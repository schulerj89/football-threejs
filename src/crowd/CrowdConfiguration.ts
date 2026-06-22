import { FIELD_DIMENSIONS } from '../fieldSpec';

export const CROWD_COUNT_DEFAULT = 500;
export const CROWD_COUNT_MAX = 10_000;
export const CROWD_COUNT_MIN = 0;
export const CROWD_BENCHMARK_COUNTS = [500, 2_000, 5_000, 10_000] as const;
export const DEFAULT_BENCHMARK_DURATION_SECONDS = 1.2;

export const TRANSFORM_MATRIX_BYTES = 16 * Float32Array.BYTES_PER_ELEMENT;
export const INSTANCE_COLOR_BYTES = 3 * Float32Array.BYTES_PER_ELEMENT;
export const CUSTOM_REACTION_BYTES = 0;
export const NEAR_MESHES_PER_SPECTATOR = 4;
export const FAR_MESHES_PER_SPECTATOR = 0;
export const NEAR_LOD_RATIO = 0.58;
export const NEAR_LOD_MAX = 2_500;
export const FAR_MOSAIC_VERTEX_BYTES = 3 * Float32Array.BYTES_PER_ELEMENT;
export const FAR_MOSAIC_COLOR_BYTES = 3 * Float32Array.BYTES_PER_ELEMENT;

export const CROWD_PREVIEW_CONFIG = {
  endZone: {
    rowCount: 22,
    rowDepth: 0.86,
    rowRise: 0.38,
    seatSpacing: 0.78,
    width: FIELD_DIMENSIONS.fieldWidth + 32,
    zOffset: 13,
  },
  sideline: {
    depth: FIELD_DIMENSIONS.fieldLength + 16,
    rowCount: 28,
    rowDepth: 0.86,
    rowRise: 0.38,
    seatSpacing: 0.78,
    xOffset: 12,
  },
  spectator: {
    armHeight: 0.33,
    armLength: 0.42,
    farHeight: 0.64,
    farWidth: 0.34,
    headRadius: 0.13,
    torsoHeight: 0.48,
  },
} as const;

export function clampCrowdCount(value: number): number {
  if (!Number.isFinite(value)) {
    return CROWD_COUNT_DEFAULT;
  }

  return Math.min(CROWD_COUNT_MAX, Math.max(CROWD_COUNT_MIN, Math.floor(value)));
}

export function resolveCrowdBenchmarkDurationSeconds(value: string | null): number {
  const parsed = Number(value ?? DEFAULT_BENCHMARK_DURATION_SECONDS);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_BENCHMARK_DURATION_SECONDS;
  }

  return Math.min(10, Math.max(0.05, parsed));
}
