import { FIELD_DIMENSIONS } from '../fieldSpec';
import {
  CROWD_PREVIEW_CONFIG,
  NEAR_LOD_MAX,
  NEAR_LOD_RATIO,
  clampCrowdCount,
} from './CrowdConfiguration';
import type { CrowdPreviewPlacement } from './CrowdTypes';

type PlacementCandidate = Omit<CrowdPreviewPlacement, 'colorSeed' | 'lod' | 'scale'>;

export function createCrowdPlacements(requestedCount: number): readonly CrowdPreviewPlacement[] {
  const actualCount = clampCrowdCount(requestedCount);
  const placementCandidates = createPlacementCandidates();
  const nearCount = Math.min(
    actualCount,
    Math.min(NEAR_LOD_MAX, Math.floor(actualCount * NEAR_LOD_RATIO)),
  );
  const placements: CrowdPreviewPlacement[] = [];

  for (let index = 0; index < actualCount; index += 1) {
    const candidate = placementCandidates[index % placementCandidates.length];
    placements.push({
      ...candidate,
      colorSeed: stableHash(`${candidate.stand}:${candidate.x.toFixed(2)}:${candidate.z.toFixed(2)}:${index}`),
      lod: index < nearCount ? 'near' : 'far',
      scale: 0.86 + (stableHash(`scale:${index}`) % 17) / 100,
    });
  }

  return placements;
}

function createPlacementCandidates(): PlacementCandidate[] {
  const candidates: PlacementCandidate[] = [];

  candidates.push(...createSidelinePlacementCandidates('sidelineLeft', -1));
  candidates.push(...createSidelinePlacementCandidates('sidelineRight', 1));
  candidates.push(...createEndZonePlacementCandidates('endZoneNear', -1));
  candidates.push(...createEndZonePlacementCandidates('endZoneFar', 1));

  return candidates.sort((a, b) => {
    const rowDistanceA = Math.hypot(
      Math.abs(a.x) - FIELD_DIMENSIONS.fieldWidth / 2,
      Math.abs(a.z) - FIELD_DIMENSIONS.fieldLength / 2,
    );
    const rowDistanceB = Math.hypot(
      Math.abs(b.x) - FIELD_DIMENSIONS.fieldWidth / 2,
      Math.abs(b.z) - FIELD_DIMENSIONS.fieldLength / 2,
    );

    return rowDistanceA - rowDistanceB || a.stand.localeCompare(b.stand) || a.z - b.z || a.x - b.x;
  });
}

function createSidelinePlacementCandidates(
  stand: 'sidelineLeft' | 'sidelineRight',
  sideSign: -1 | 1,
): PlacementCandidate[] {
  const candidates: PlacementCandidate[] = [];
  const config = CROWD_PREVIEW_CONFIG.sideline;
  const seatsPerRow = Math.floor(config.depth / config.seatSpacing);
  const startZ = -config.depth / 2;
  const baseX = sideSign * (FIELD_DIMENSIONS.fieldWidth / 2 + config.xOffset);

  for (let row = 0; row < config.rowCount; row += 1) {
    for (let seat = 0; seat < seatsPerRow; seat += 1) {
      const jitter = ((stableHash(`${stand}:${row}:${seat}`) % 100) / 100 - 0.5) * 0.13;
      candidates.push({
        facingRadians: sideSign > 0 ? -Math.PI / 2 : Math.PI / 2,
        stand,
        x: baseX + sideSign * row * config.rowDepth,
        y: 0.25 + row * config.rowRise,
        z: startZ + seat * config.seatSpacing + jitter,
      });
    }
  }

  return candidates;
}

function createEndZonePlacementCandidates(
  stand: 'endZoneFar' | 'endZoneNear',
  endSign: -1 | 1,
): PlacementCandidate[] {
  const candidates: PlacementCandidate[] = [];
  const config = CROWD_PREVIEW_CONFIG.endZone;
  const seatsPerRow = Math.floor(config.width / config.seatSpacing);
  const startX = -config.width / 2;
  const baseZ = endSign * (FIELD_DIMENSIONS.fieldLength / 2 + config.zOffset);

  for (let row = 0; row < config.rowCount; row += 1) {
    for (let seat = 0; seat < seatsPerRow; seat += 1) {
      const jitter = ((stableHash(`${stand}:${row}:${seat}`) % 100) / 100 - 0.5) * 0.13;
      candidates.push({
        facingRadians: endSign > 0 ? Math.PI : 0,
        stand,
        x: startX + seat * config.seatSpacing + jitter,
        y: 0.25 + row * config.rowRise,
        z: baseZ + endSign * row * config.rowDepth,
      });
    }
  }

  return candidates;
}

export function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
