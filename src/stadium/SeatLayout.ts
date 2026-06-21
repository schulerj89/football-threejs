import {
  NEAR_LOD_MAX,
  NEAR_LOD_RATIO,
  clampCrowdCount,
} from '../crowd/CrowdConfiguration';
import { DEFAULT_STADIUM_SPEC } from './StadiumSpec';
import { createStadiumRows } from './StadiumLayout';
import {
  createStadiumPath,
  offsetPathSample,
  samplePathAtDistance,
} from './StadiumPath';
import type {
  SeatLayout,
  SeatTransform,
  StadiumPathSample,
  StadiumSectionId,
  StadiumSpec,
} from './StadiumTypes';

export function createSeatLayout(
  spec: StadiumSpec = DEFAULT_STADIUM_SPEC,
  options: {
    requestedCount?: number;
    upperTierEnabled?: boolean;
  } = {},
): SeatLayout {
  const rows = createStadiumRows(spec, options.upperTierEnabled ?? true);
  const path = createStadiumPath(spec);
  const requestedCount = options.requestedCount === undefined
    ? Number.POSITIVE_INFINITY
    : clampCrowdCount(options.requestedCount);
  const candidates: SeatTransform[] = [];

  for (const row of rows) {
    for (const segment of path.segments) {
      const seatCount = Math.max(1, Math.floor(segment.length / spec.seatSpacing));
      for (let seat = 0; seat < seatCount; seat += 1) {
        const distanceAlongSection = (seat + 0.5) * (segment.length / seatCount);
        if (isInsideTunnel(spec, segment.id, distanceAlongSection)) {
          continue;
        }
        const sample = samplePathAtDistance(
          path,
          segment.startDistance + distanceAlongSection,
          spec,
        );
        const position2 = offsetPathSample(sample, row.offset);
        candidates.push({
          facingRadians: facingRadiansForSample(sample),
          lod: 'far',
          position: {
            x: position2.x,
            y: row.elevation,
            z: position2.z,
          },
          row: row.globalRow,
          scale: 0.86 + (stableHash(`seat-scale:${row.globalRow}:${segment.id}:${seat}`) % 17) / 100,
          seatIndex: seat,
          sectionId: segment.id,
          tier: row.tier,
        });
      }
    }
  }

  const orderedSeats = candidates.sort(compareSeats);
  const actualCount = Math.min(requestedCount, orderedSeats.length);
  const nearCount = Math.min(
    actualCount,
    Math.min(NEAR_LOD_MAX, Math.floor(actualCount * NEAR_LOD_RATIO)),
  );
  const seats = orderedSeats.slice(0, actualCount).map((seat, index) => ({
    ...seat,
    lod: index < nearCount ? 'near' as const : 'far' as const,
  }));

  return {
    rows,
    seatCountBySection: countSeatsBySection(seats),
    seats,
    spec,
  };
}

export function createCrowdSeatTransforms(
  requestedCount: number,
  spec: StadiumSpec = DEFAULT_STADIUM_SPEC,
  upperTierEnabled = true,
): readonly SeatTransform[] {
  return createSeatLayout(spec, { requestedCount, upperTierEnabled }).seats;
}

export function isInsideTunnel(
  spec: StadiumSpec,
  sectionId: StadiumSectionId,
  distanceAlongSection: number,
): boolean {
  return spec.tunnels.some((tunnel) =>
    tunnel.sectionId === sectionId &&
    Math.abs(distanceAlongSection - tunnel.centerDistanceAlongSection) <= tunnel.width / 2);
}

export function calculateSeatSpacingError(
  seats: readonly SeatTransform[],
  sectionId: StadiumSectionId,
  row: number,
): number {
  const rowSeats = seats
    .filter((seat) => seat.sectionId === sectionId && seat.row === row)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  if (rowSeats.length < 2) {
    return 0;
  }

  const distances: number[] = [];
  for (let index = 1; index < rowSeats.length; index += 1) {
    if (rowSeats[index].seatIndex !== rowSeats[index - 1].seatIndex + 1) {
      continue;
    }
    const previous = rowSeats[index - 1].position;
    const current = rowSeats[index].position;
    distances.push(Math.hypot(current.x - previous.x, current.z - previous.z));
  }
  if (distances.length === 0) {
    return 0;
  }
  const average = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
  return Math.max(...distances.map((distance) => Math.abs(distance - average)));
}

function facingRadiansForSample(sample: StadiumPathSample): number {
  const inward = {
    x: -sample.normal.x,
    z: -sample.normal.z,
  };
  return Math.atan2(inward.x, inward.z);
}

function compareSeats(a: SeatTransform, b: SeatTransform): number {
  return a.row - b.row ||
    a.tier - b.tier ||
    sectionOrder(a.sectionId) - sectionOrder(b.sectionId) ||
    a.seatIndex - b.seatIndex;
}

function sectionOrder(sectionId: StadiumSectionId): number {
  return [
    'sidelineLeft',
    'sidelineRight',
    'endZoneNear',
    'endZoneFar',
    'cornerNearLeft',
    'cornerNearRight',
    'cornerFarLeft',
    'cornerFarRight',
  ].indexOf(sectionId);
}

function countSeatsBySection(
  seats: readonly SeatTransform[],
): Readonly<Record<StadiumSectionId, number>> {
  const counts: Record<StadiumSectionId, number> = {
    cornerFarLeft: 0,
    cornerFarRight: 0,
    cornerNearLeft: 0,
    cornerNearRight: 0,
    endZoneFar: 0,
    endZoneNear: 0,
    sidelineLeft: 0,
    sidelineRight: 0,
  };
  for (const seat of seats) {
    counts[seat.sectionId] += 1;
  }
  return counts;
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}
